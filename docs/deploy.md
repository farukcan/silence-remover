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
6. Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin (needed for Open Graph + PWA).
7. Set `NEXT_PUBLIC_UMAMI_URL` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in Dokploy (production analytics).
8. Configure object storage (prefer R2 in production — see below).
9. Confirm `S3_PUBLIC_ENDPOINT` is reachable from end-user browsers.
10. Deploy and hit `/` then run a short audio job end-to-end.

PWA / home screen: after deploy, open the site in mobile Safari or Chrome → Share / Install → Add to Home Screen. Manifest is at `/manifest.webmanifest`; icons at `/icon-192` and `/icon-512`.

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
| `NEXT_PUBLIC_SITE_URL` | Web | Absolute site origin for Open Graph / WhatsApp / PWA |
| `NEXT_PUBLIC_UMAMI_URL` | Web (prod) | Umami origin, e.g. `https://umami.puhulab.com` (defaults in code if unset) |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Web (prod) | Umami website ID (defaults in code if unset) |
| `NEXT_PUBLIC_UMAMI_DISABLED` | Web | Set to `1` to disable the tracker (useful locally) |
| `CORS_ORIGINS` | API | Default `*` |
| `COMPOSE_PROFILES` | No | Set to `minio` for local MinIO; leave empty for R2 |
| `OBJECT_RETENTION_HOURS` | No | Default `24` — worker deletes media after this age |
| `CLEANUP_INTERVAL_SEC` | No | Default `900` — cleanup poll interval |

Full template: [`.env.example`](../.env.example).

`NEXT_PUBLIC_*` values are baked into the Next.js image at **build** time. After changing Umami (or site URL) env vars in Dokploy, rebuild/redeploy the `web` service.

The tracker must be a native `<script defer>` in the document (not `next/script`). Umami reads `document.currentScript`; dynamically injected scripts never set `window.umami`.

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

**CORS (required for browser uploads to R2):** Cloudflare Dashboard → R2 → bucket `silence-remover` → **Settings** → **CORS policy**. Example:

```json
[
  {
    "AllowedOrigins": [
      "https://silence-remover.puhulab.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add `http://localhost:3000` to `AllowedOrigins` if you also upload from local. Origin must match exactly (scheme + host, no trailing slash).

Browser **upload** (PUT) and **download/preview** (GET) talk to R2 directly via presigned URLs. Your CORS rule must allow `GET`, `PUT`, and `HEAD` from the web origin (as in the screenshot for `https://silence-remover.puhulab.com`). Without that policy, browser preflight fails with *No 'Access-Control-Allow-Origin' header*.

### Object retention (1 day)

The **worker** deletes input/output objects older than `OBJECT_RETENTION_HOURS` (default **24**). This is the app’s retention guarantee shown on the site footer.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OBJECT_RETENTION_HOURS` | `24` | Delete stored media after this age |
| `CLEANUP_INTERVAL_SEC` | `900` | How often the worker runs cleanup |
| `UPLOAD_URL_TTL_SEC` | `3600` | Presigned **upload** URL expiry (not object retention) |
| `DOWNLOAD_URL_TTL_SEC` | `3600` | Presigned **download** URL expiry (not object retention) |

Optional belt-and-suspenders: in Cloudflare R2 → bucket → **Settings** → **Object lifecycle rules**, add a rule to delete objects after 1 day for prefixes `uploads/` and `outputs/`.

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
