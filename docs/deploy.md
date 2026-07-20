# Deploy

Target: single Linux VPS with **Dokploy** + this repo’s [`docker-compose.yml`](../docker-compose.yml).

HTTPS and domain routing are handled by Dokploy — there is no Caddy service in Compose.

## Services

| Service | Public? | Notes |
|---------|---------|--------|
| `web` | **Yes** | Attach Dokploy domain + TLS here only |
| `api` | No | Reachable as `http://api:8080` from `web` |
| `worker` | No | One replica; CPU-bound ffmpeg encode |
| `postgres` | No | Volume `postgres_data` |
| `redis` | No | Queue + rate limit |
| `minio` | Optional | Profile `minio` only; port `9000` for browser presign |
| `minio-init` | Optional | Profile `minio` only; creates bucket once |

## Quick start (local)

```bash
cp .env.example .env
# .env.example sets COMPOSE_PROFILES=minio for local object storage
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- UI: `http://localhost:3000` (published only via `docker-compose.local.yml`)
- MinIO API: `http://localhost:9000` (must match `S3_PUBLIC_ENDPOINT` for browser uploads)
- Without `COMPOSE_PROFILES=minio` (or `--profile minio`), MinIO containers are not started

`docker-compose.yml` does **not** bind host ports for `web` — Dokploy’s proxy reaches container port `3000` via `expose`. Binding `3000:3000` on the VPS fails when that port is already taken.

## Dokploy checklist

1. Create a Compose application from this Git repository.
2. Copy env from [`.env.example`](../.env.example); set strong `POSTGRES_PASSWORD` and real S3 credentials.
3. Domain → **`web` service only** (container port **3000**). Do not expose `api`.
4. Do **not** add `docker-compose.local.yml` on Dokploy (it binds host `:3000`).
5. Set `API_INTERNAL_URL=http://api:8080` (Compose DNS name).
6. Configure object storage (prefer R2 in production — see below).
7. Confirm `S3_PUBLIC_ENDPOINT` is reachable from end-user browsers.
8. Deploy and hit `/` then run a short audio job end-to-end.

## Environment reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGRES_PASSWORD` | Yes | Postgres password (also embedded in `DATABASE_URL` for api/worker) |
| `S3_ENDPOINT` | Yes | Server-side S3 API URL (`http://minio:9000` or R2) |
| `S3_PUBLIC_ENDPOINT` | Yes | Browser-facing S3/R2 URL used for presigned PUT/GET |
| `S3_BUCKET` | Yes | Bucket name |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Yes | Credentials |
| `S3_REGION` | Yes | `us-east-1` (MinIO) or `auto` (R2) |
| `S3_FORCE_PATH_STYLE` | Usually `true` | Path-style addressing |
| `RATE_LIMIT_JOBS_PER_DAY` | No | Default `10` |
| `RATE_LIMIT_MAX_CONCURRENT` | No | Default `2` |
| `MAX_UPLOAD_BYTES` | No | Default `209715200` |
| `API_INTERNAL_URL` | Web | Default `http://api:8080` |
| `CORS_ORIGINS` | API | Default `*` |
| `COMPOSE_PROFILES` | No | Set to `minio` for local MinIO; leave empty for R2 |

Full template: [`.env.example`](../.env.example).

## Object storage

### Local / MinIO

Enable the Compose profile, then start. Compose creates the bucket via `minio-init`.

```env
COMPOSE_PROFILES=minio
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

Or: `docker compose --profile minio up --build`.

On a remote VPS, `localhost` is wrong for browsers. Either:

- Put MinIO behind a Dokploy subdomain and set `S3_PUBLIC_ENDPOINT` to that HTTPS URL, or
- Switch to Cloudflare R2 (recommended).

### Cloudflare R2 (production)

Do **not** set `COMPOSE_PROFILES=minio` (omit or leave empty). MinIO containers stay off.

```env
COMPOSE_PROFILES=
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_PUBLIC_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<r2_access_key>
S3_SECRET_KEY=<r2_secret_key>
S3_FORCE_PATH_STYLE=true
S3_BUCKET=silence-remover
```

**CORS:** allow PUT/GET from your web origin on the R2/MinIO bucket so browser uploads succeed.

## Resource guidance

- Start with **2–4 vCPU / 4–8 GB RAM** (Dokploy overhead included).
- Keep worker concurrency at **1** (Compose runs a single worker process).
- Video re-encode (`libx264`) dominates CPU; VAD itself is light.
- Keep temp files on the worker container disk; durable media lives in object storage.

## Smoke test after deploy

1. Open the public site over HTTPS.
2. Upload a short `.mp3`.
3. Confirm status moves `queued` → `processing` → `completed`.
4. Download the output.
5. Repeat until rate limit (`429`) to verify limits.

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Host port publish on Dokploy — use base `docker-compose.yml` only (no `docker-compose.local.yml`) |
| Upload fails in browser | `S3_PUBLIC_ENDPOINT` not reachable or bucket CORS |
| Job stuck `pending_upload` | Complete-upload never called / HeadObject failed |
| Job stuck `queued` | Worker not running or Redis key mismatch (`QUEUE_KEY`) |
| Always rate limited | Spoofed/shared IP; raise limits or check `X-Real-IP` from Dokploy |
| `api` 502 from web | Wrong `API_INTERNAL_URL` or `api` container unhealthy |

## Related

- [Architecture](./architecture.md) — job flow and trust boundaries
- [API](./api.md) — endpoint contracts
