package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/farukcan/silence-remover/apps/api/internal/config"
	"github.com/farukcan/silence-remover/apps/api/internal/db"
	"github.com/farukcan/silence-remover/apps/api/internal/queue"
	"github.com/farukcan/silence-remover/apps/api/internal/ratelimit"
	"github.com/farukcan/silence-remover/apps/api/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type API struct {
	Cfg     config.Config
	Store   *db.Store
	Limiter *ratelimit.Limiter
	Queue   *queue.Queue
	Storage *storage.Client
}

type createJobRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
}

type createJobResponse struct {
	JobID     string `json:"job_id"`
	Token     string `json:"token"`
	UploadURL string `json:"upload_url"`
	InputKey  string `json:"input_key"`
	ExpiresIn int    `json:"expires_in_sec"`
}

type jobResponse struct {
	JobID               string   `json:"job_id"`
	Status              string   `json:"status"`
	OriginalFilename    string   `json:"original_filename"`
	DownloadURL         *string  `json:"download_url,omitempty"`
	PreviewOriginalURL  *string  `json:"preview_original_url,omitempty"`
	PreviewProcessedURL *string  `json:"preview_processed_url,omitempty"`
	InputDurationSec    *float64 `json:"input_duration_sec,omitempty"`
	OutputDurationSec   *float64 `json:"output_duration_sec,omitempty"`
	Error               *string  `json:"error,omitempty"`
	CreatedAt           string   `json:"created_at"`
	UpdatedAt           string   `json:"updated_at"`
}

func (a *API) Healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) CreateJob(w http.ResponseWriter, r *http.Request) {
	var req createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Filename = strings.TrimSpace(req.Filename)
	if req.Filename == "" {
		writeError(w, http.StatusBadRequest, "filename is required")
		return
	}
	if req.ContentType == "" {
		req.ContentType = "application/octet-stream"
	}
	if !allowedFilename(req.Filename) {
		writeError(w, http.StatusBadRequest, "unsupported file type")
		return
	}

	ip := clientIP(r)
	active, err := a.Store.CountActiveByIP(r.Context(), ip)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check concurrent jobs")
		return
	}
	if err := a.Limiter.AllowCreate(r.Context(), ip, active); err != nil {
		writeError(w, http.StatusTooManyRequests, err.Error())
		return
	}

	jobID := uuid.New()
	token := uuid.NewString()
	ext := strings.ToLower(filepath.Ext(req.Filename))
	inputKey := "uploads/" + jobID.String() + "/input" + ext
	outputKey := "outputs/" + jobID.String() + "/output" + ext

	uploadURL, err := a.Storage.PresignPut(r.Context(), inputKey, "application/octet-stream")
	if err != nil {
		a.Limiter.RefundCreate(r.Context(), ip)
		writeError(w, http.StatusInternalServerError, "failed to create upload URL")
		return
	}

	job := db.Job{
		ID:               jobID,
		Token:            token,
		Status:           db.StatusPendingUpload,
		OriginalFilename: filepath.Base(req.Filename),
		ContentType:      req.ContentType,
		InputKey:         inputKey,
		OutputKey:        outputKey,
		ClientIP:         ip,
	}
	if err := a.Store.CreateJob(r.Context(), job); err != nil {
		a.Limiter.RefundCreate(r.Context(), ip)
		writeError(w, http.StatusInternalServerError, "failed to create job")
		return
	}

	writeJSON(w, http.StatusCreated, createJobResponse{
		JobID:     jobID.String(),
		Token:     token,
		UploadURL: uploadURL,
		InputKey:  inputKey,
		ExpiresIn: int(a.Cfg.UploadURLTTL.Seconds()),
	})
}

func (a *API) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	job, ok := a.authorizeJob(w, r)
	if !ok {
		return
	}
	if job.Status != db.StatusPendingUpload {
		writeError(w, http.StatusConflict, "job is not awaiting upload")
		return
	}

	size, err := a.Storage.Head(r.Context(), job.InputKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "upload not found; upload the file first")
		return
	}
	if size <= 0 {
		writeError(w, http.StatusBadRequest, "uploaded object is empty")
		return
	}
	if size > a.Cfg.MaxUploadBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "file exceeds max upload size")
		return
	}

	if err := a.Store.MarkQueued(r.Context(), job.ID); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	if err := a.Queue.Enqueue(r.Context(), queue.Message{
		JobID:     job.ID,
		InputKey:  job.InputKey,
		OutputKey: job.OutputKey,
	}); err != nil {
		_ = a.Store.MarkPendingUpload(r.Context(), job.ID)
		writeError(w, http.StatusInternalServerError, "failed to enqueue job")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"job_id": job.ID.String(),
		"status": string(db.StatusQueued),
	})
}

func (a *API) GetJob(w http.ResponseWriter, r *http.Request) {
	job, ok := a.authorizeJob(w, r)
	if !ok {
		return
	}

	resp := jobResponse{
		JobID:            job.ID.String(),
		Status:           string(job.Status),
		OriginalFilename: job.OriginalFilename,
		CreatedAt:        job.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:        job.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if job.Error.Valid {
		resp.Error = &job.Error.String
	}
	if job.InputDurationSec.Valid {
		v := job.InputDurationSec.Float64
		resp.InputDurationSec = &v
	}
	if job.OutputDurationSec.Valid {
		v := job.OutputDurationSec.Float64
		resp.OutputDurationSec = &v
	}
	if job.Status == db.StatusCompleted && job.OutputKey != "" {
		name := job.OriginalFilename
		if name == "" {
			name = "output"
		}
		url, err := a.Storage.PresignGet(r.Context(), job.OutputKey, name)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create download URL")
			return
		}
		resp.DownloadURL = &url

		processedPreview, err := a.Storage.PresignGetPreview(r.Context(), job.OutputKey, name)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create preview URL")
			return
		}
		resp.PreviewProcessedURL = &processedPreview

		if job.InputKey != "" {
			originalPreview, err := a.Storage.PresignGetPreview(r.Context(), job.InputKey, name)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to create preview URL")
				return
			}
			resp.PreviewOriginalURL = &originalPreview
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (a *API) authorizeJob(w http.ResponseWriter, r *http.Request) (db.Job, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return db.Job{}, false
	}
	token := r.Header.Get("X-Job-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		writeError(w, http.StatusUnauthorized, "missing job token")
		return db.Job{}, false
	}

	job, err := a.Store.GetJob(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "job not found")
			return db.Job{}, false
		}
		writeError(w, http.StatusInternalServerError, "failed to load job")
		return db.Job{}, false
	}
	if job.Token != token {
		writeError(w, http.StatusUnauthorized, "invalid job token")
		return db.Job{}, false
	}
	return job, true
}

func allowedFilename(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".wma",
		".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v":
		return true
	default:
		return false
	}
}

func clientIP(r *http.Request) string {
	// Prefer proxy-injected Real-IP over client-controlled X-Forwarded-For.
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		// Right-most hop is typically the immediate proxy; left-most is easiest to spoof.
		ip := strings.TrimSpace(parts[len(parts)-1])
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
