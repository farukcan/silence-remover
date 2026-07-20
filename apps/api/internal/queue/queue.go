package queue

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Message struct {
	JobID     uuid.UUID `json:"job_id"`
	InputKey  string    `json:"input_key"`
	OutputKey string    `json:"output_key"`
}

type Queue struct {
	rdb *redis.Client
	key string
}

func New(rdb *redis.Client, key string) *Queue {
	return &Queue{rdb: rdb, key: key}
}

func (q *Queue) Enqueue(ctx context.Context, msg Message) error {
	b, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return q.rdb.LPush(ctx, q.key, b).Err()
}
