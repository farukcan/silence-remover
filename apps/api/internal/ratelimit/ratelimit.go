package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Limiter struct {
	rdb         *redis.Client
	maxPerDay   int
	maxConcurrent int
}

func New(rdb *redis.Client, maxPerDay, maxConcurrent int) *Limiter {
	return &Limiter{
		rdb:           rdb,
		maxPerDay:     maxPerDay,
		maxConcurrent: maxConcurrent,
	}
}

func (l *Limiter) AllowCreate(ctx context.Context, ip string, activeCount int) error {
	if ip == "" {
		ip = "unknown"
	}
	if activeCount >= l.maxConcurrent {
		return fmt.Errorf("too many concurrent jobs (max %d)", l.maxConcurrent)
	}

	day := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("ratelimit:jobs:%s:%s", ip, day)

	n, err := l.rdb.Incr(ctx, key).Result()
	if err != nil {
		return err
	}
	if n == 1 {
		_ = l.rdb.Expire(ctx, key, 48*time.Hour).Err()
	}
	if int(n) > l.maxPerDay {
		_, _ = l.rdb.Decr(ctx, key).Result()
		return fmt.Errorf("daily job limit reached (max %d/day)", l.maxPerDay)
	}
	return nil
}

func (l *Limiter) RefundCreate(ctx context.Context, ip string) {
	if ip == "" {
		ip = "unknown"
	}
	day := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("ratelimit:jobs:%s:%s", ip, day)
	_, _ = l.rdb.Decr(ctx, key).Result()
}
