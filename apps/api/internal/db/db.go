package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type Status string

const (
	StatusPendingUpload Status = "pending_upload"
	StatusQueued        Status = "queued"
	StatusProcessing    Status = "processing"
	StatusCompleted     Status = "completed"
	StatusFailed        Status = "failed"
)

type Job struct {
	ID               uuid.UUID
	Token            string
	Status           Status
	OriginalFilename string
	ContentType      string
	InputKey         string
	OutputKey        string
	Error            sql.NullString
	ClientIP         string
	InputDurationSec sql.NullFloat64
	OutputDurationSec sql.NullFloat64
	CreatedAt        time.Time
	UpdatedAt        time.Time
	CompletedAt      sql.NullTime
}

type Store struct {
	DB *sql.DB
}

func Connect(ctx context.Context, databaseURL string) (*Store, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}

	store := &Store{DB: db}
	if err := store.Migrate(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	return s.DB.Close()
}

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.DB.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  original_filename TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  input_key TEXT NOT NULL,
  output_key TEXT NOT NULL DEFAULT '',
  error TEXT,
  client_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_ip_created ON jobs(client_ip, created_at);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS input_duration_sec DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS output_duration_sec DOUBLE PRECISION;
`)
	return err
}

func (s *Store) CreateJob(ctx context.Context, job Job) error {
	_, err := s.DB.ExecContext(ctx, `
INSERT INTO jobs (
  id, token, status, original_filename, content_type, input_key, output_key, client_ip
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
`, job.ID, job.Token, job.Status, job.OriginalFilename, job.ContentType, job.InputKey, job.OutputKey, job.ClientIP)
	return err
}

func (s *Store) GetJob(ctx context.Context, id uuid.UUID) (Job, error) {
	var job Job
	err := s.DB.QueryRowContext(ctx, `
SELECT id, token, status, original_filename, content_type, input_key, output_key,
       error, client_ip, input_duration_sec, output_duration_sec,
       created_at, updated_at, completed_at
FROM jobs WHERE id = $1
`, id).Scan(
		&job.ID, &job.Token, &job.Status, &job.OriginalFilename, &job.ContentType,
		&job.InputKey, &job.OutputKey, &job.Error, &job.ClientIP,
		&job.InputDurationSec, &job.OutputDurationSec,
		&job.CreatedAt, &job.UpdatedAt, &job.CompletedAt,
	)
	if err != nil {
		return Job{}, err
	}
	return job, nil
}

func (s *Store) MarkQueued(ctx context.Context, id uuid.UUID) error {
	res, err := s.DB.ExecContext(ctx, `
UPDATE jobs SET status = $2, updated_at = NOW()
WHERE id = $1 AND status = $3
`, id, StatusQueued, StatusPendingUpload)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("job not in pending_upload state")
	}
	return nil
}

func (s *Store) MarkPendingUpload(ctx context.Context, id uuid.UUID) error {
	_, err := s.DB.ExecContext(ctx, `
UPDATE jobs SET status = $2, updated_at = NOW()
WHERE id = $1 AND status = $3
`, id, StatusPendingUpload, StatusQueued)
	return err
}

func (s *Store) CountActiveByIP(ctx context.Context, ip string) (int, error) {
	var n int
	// Ignore abandoned pending uploads older than 2 hours so they do not block the concurrent slot.
	err := s.DB.QueryRowContext(ctx, `
SELECT COUNT(*) FROM jobs
WHERE client_ip = $1
  AND (
    status IN ('queued', 'processing')
    OR (status = 'pending_upload' AND created_at > NOW() - INTERVAL '2 hours')
  )
`, ip).Scan(&n)
	return n, err
}
