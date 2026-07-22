package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/farukcan/silence-remover/apps/api/internal/config"
	"github.com/farukcan/silence-remover/apps/api/internal/db"
	"github.com/farukcan/silence-remover/apps/api/internal/handlers"
	"github.com/farukcan/silence-remover/apps/api/internal/queue"
	"github.com/farukcan/silence-remover/apps/api/internal/ratelimit"
	"github.com/farukcan/silence-remover/apps/api/internal/storage"
	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	if err := initSentry(); err != nil {
		log.Printf("sentry: init skipped: %v", err)
	}
	defer sentry.Flush(2 * time.Second)

	ctx := context.Background()
	store, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer store.Close()

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rdb.Close()

	s3Client, err := storage.New(cfg)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	api := &handlers.API{
		Cfg:     cfg,
		Store:   store,
		Limiter: ratelimit.New(rdb, cfg.MaxJobsPerDay, cfg.MaxConcurrent),
		Queue:   queue.New(rdb, cfg.QueueKey),
		Storage: s3Client,
	}

	sentryHandler := sentryhttp.New(sentryhttp.Options{
		Repanic: true,
	})

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(sentryHandler.Handle)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-Job-Token"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", api.Healthz)
	r.Route("/v1", func(r chi.Router) {
		r.Get("/__bugsink_test", api.BugsinkTest)
		r.Post("/jobs", api.CreateJob)
		r.Post("/jobs/{id}/complete-upload", api.CompleteUpload)
		r.Get("/jobs/{id}", api.GetJob)
	})

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("api listening on %s", cfg.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

func initSentry() error {
	if os.Getenv("SENTRY_DISABLED") == "1" {
		return nil
	}
	dsn := strings.TrimSpace(os.Getenv("SENTRY_DSN"))
	if dsn == "" {
		return nil
	}
	env := strings.TrimSpace(os.Getenv("SENTRY_ENVIRONMENT"))
	if env == "" {
		env = "production"
	}
	return sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      env,
		SendDefaultPII:   true,
		EnableTracing:    false,
		AttachStacktrace: true,
		Tags: map[string]string{
			"service": "api",
		},
	})
}
