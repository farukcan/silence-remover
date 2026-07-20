package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/farukcan/silence-remover/apps/api/internal/config"
)

type Client struct {
	internal    *s3.Client
	presign     *s3.PresignClient
	bucket      string
	ttlUpload   time.Duration
	ttlDownload time.Duration
}

func newS3(cfg config.Config, endpoint string) *s3.Client {
	awsCfg := aws.Config{
		Region: cfg.S3Region,
		Credentials: credentials.NewStaticCredentialsProvider(
			cfg.S3AccessKey,
			cfg.S3SecretKey,
			"",
		),
	}
	return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.S3ForcePathStyle
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
		}
	})
}

func New(cfg config.Config) (*Client, error) {
	internal := newS3(cfg, cfg.S3Endpoint)
	publicEndpoint := cfg.S3PublicEndpoint
	if publicEndpoint == "" {
		publicEndpoint = cfg.S3Endpoint
	}
	public := newS3(cfg, publicEndpoint)

	return &Client{
		internal:    internal,
		presign:     s3.NewPresignClient(public),
		bucket:      cfg.S3Bucket,
		ttlUpload:   cfg.UploadURLTTL,
		ttlDownload: cfg.DownloadURLTTL,
	}, nil
}

func (c *Client) PresignPut(ctx context.Context, key, contentType string) (string, error) {
	out, err := c.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(c.ttlUpload))
	if err != nil {
		return "", fmt.Errorf("presign put: %w", err)
	}
	return out.URL, nil
}

func (c *Client) PresignGet(ctx context.Context, key string) (string, error) {
	out, err := c.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(c.ttlDownload))
	if err != nil {
		return "", fmt.Errorf("presign get: %w", err)
	}
	return out.URL, nil
}

func (c *Client) Head(ctx context.Context, key string) (int64, error) {
	out, err := c.internal.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return 0, err
	}
	if out.ContentLength == nil {
		return 0, nil
	}
	return *out.ContentLength, nil
}
