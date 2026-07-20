package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr            string
	DatabaseURL     string
	RedisURL        string
	S3Endpoint       string
	S3PublicEndpoint string
	S3Region         string
	S3Bucket         string
	S3AccessKey      string
	S3SecretKey      string
	S3ForcePathStyle bool
	QueueKey        string
	MaxJobsPerDay   int
	MaxConcurrent   int
	MaxUploadBytes  int64
	UploadURLTTL    time.Duration
	DownloadURLTTL  time.Duration
	TrustedProxies  []string
	CORSOrigins     []string
}

func Load() (Config, error) {
	cfg := Config{
		Addr:             env("API_ADDR", ":8080"),
		DatabaseURL:      env("DATABASE_URL", ""),
		RedisURL:         env("REDIS_URL", "redis://redis:6379/0"),
		S3Endpoint:       env("S3_ENDPOINT", ""),
		S3PublicEndpoint: env("S3_PUBLIC_ENDPOINT", ""),
		S3Region:         env("S3_REGION", "auto"),
		S3Bucket:         env("S3_BUCKET", "silence-remover"),
		S3AccessKey:      env("S3_ACCESS_KEY", ""),
		S3SecretKey:      env("S3_SECRET_KEY", ""),
		S3ForcePathStyle: envBool("S3_FORCE_PATH_STYLE", true),
		QueueKey:         env("QUEUE_KEY", "jobs:silence"),
		MaxJobsPerDay:    envInt("RATE_LIMIT_JOBS_PER_DAY", 10),
		MaxConcurrent:    envInt("RATE_LIMIT_MAX_CONCURRENT", 2),
		MaxUploadBytes:   envInt64("MAX_UPLOAD_BYTES", 200*1024*1024),
		UploadURLTTL:     time.Duration(envInt("UPLOAD_URL_TTL_SEC", 3600)) * time.Second,
		DownloadURLTTL:   time.Duration(envInt("DOWNLOAD_URL_TTL_SEC", 3600)) * time.Second,
		TrustedProxies:   splitCSV(env("TRUSTED_PROXIES", "")),
		CORSOrigins:      splitCSV(env("CORS_ORIGINS", "*")),
	}

	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.S3AccessKey == "" || cfg.S3SecretKey == "" {
		return cfg, fmt.Errorf("S3_ACCESS_KEY and S3_SECRET_KEY are required")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envInt64(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return fallback
	}
	return n
}

func envBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	return v == "1" || v == "true" || v == "yes"
}

func splitCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
