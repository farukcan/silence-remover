# Internal API

Go service in [`apps/api`](../apps/api/). Base URL inside Compose: `http://api:8080`.

MVP: **not publicly routed**. Next.js BFF under `/api/jobs*` calls this API with `API_INTERNAL_URL`.

## Auth model

No user auth. Each job has a secret **token** returned from `POST /v1/jobs`.

Send it as:

```http
X-Job-Token: <token>
```

Query `?token=` is also accepted by the Go handler (prefer the header).

Without a valid token, complete/status return `401`.

## Endpoints

### `GET /healthz`

Liveness. No auth.

```json
{ "status": "ok" }
```

### `POST /v1/jobs`

Create a job and a presigned upload URL.

**Body**

```json
{
  "filename": "voiceover.mp3",
  "content_type": "audio/mpeg"
}
```

`filename` extension must be one of:  
`.mp3 .wav .m4a .aac .flac .ogg .wma .mp4 .mov .mkv .webm .avi .m4v`

`content_type` is stored as job metadata only. The presigned PUT is always signed for  
`Content-Type: application/octet-stream` (browser must PUT with that header) so objects are not treated as inline-playable media.

**Response `201`**

```json
{
  "job_id": "uuid",
  "token": "uuid",
  "upload_url": "https://...",
  "input_key": "uploads/<job_id>/input.mp3",
  "expires_in_sec": 3600
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Missing/invalid filename or unsupported type |
| `429` | Daily or concurrent rate limit |
| `500` | DB / storage failure |

### `POST /v1/jobs/{id}/complete-upload`

After the browser finishes the presigned PUT. Verifies the object exists (Head), enforces max size, marks job `queued`, pushes Redis message.

**Headers:** `X-Job-Token`

**Response `200`**

```json
{ "job_id": "uuid", "status": "queued" }
```

**Errors**

| Status | When |
|--------|------|
| `401` | Missing/invalid token |
| `404` | Unknown job |
| `409` | Job not in `pending_upload` |
| `400` | Object missing/empty |
| `413` | Over `MAX_UPLOAD_BYTES` |
| `500` | Enqueue failure (status rolled back to `pending_upload`) |

### `GET /v1/jobs/{id}`

**Headers:** `X-Job-Token`

**Response `200`**

```json
{
  "job_id": "uuid",
  "status": "completed",
  "original_filename": "voiceover.mp3",
  "download_url": "https://...",
  "error": null,
  "created_at": "2026-07-19T00:00:00Z",
  "updated_at": "2026-07-19T00:00:00Z"
}
```

`download_url` is present only when `status` is `completed` and the output object still exists (objects are purged after `OBJECT_RETENTION_HOURS`, default 24h).

When completed, the response also includes:

| Field | Purpose |
|-------|---------|
| `preview_original_url` | Short-lived inline-playable URL for the uploaded input |
| `preview_processed_url` | Short-lived inline-playable URL for the processed output |
| `input_duration_sec` | Input duration from processing |
| `output_duration_sec` | Output duration from processing |

Presigned GET for **download** uses `Content-Disposition: attachment` + `application/octet-stream`. Preview URLs use `inline` + a real media Content-Type so browsers can play in-page. The web UI downloads by fetching `download_url` directly from object storage (no file proxy through the app server).

## Rate limits

Configured via env (defaults in parentheses):

| Env | Default | Behavior |
|-----|---------|----------|
| `RATE_LIMIT_JOBS_PER_DAY` | `10` | Redis counter per IP per UTC day |
| `RATE_LIMIT_MAX_CONCURRENT` | `2` | Active `queued`/`processing` + recent `pending_upload` (under 2h) |
| `MAX_UPLOAD_BYTES` | `209715200` (200 MB) | Checked on complete-upload |

Client IP resolution: `X-Real-IP`, then right-most `X-Forwarded-For` hop, then `RemoteAddr`.

## Queue message

Redis list key: `QUEUE_KEY` (default `jobs:silence`). Payload:

```json
{
  "job_id": "uuid",
  "input_key": "uploads/.../input.ext",
  "output_key": "outputs/.../output.ext"
}
```

Worker: [`apps/worker/worker.py`](../apps/worker/worker.py) (`BRPOP`).

## Next.js proxy mapping

| Browser → Web | Web → Go |
|---------------|----------|
| `POST /api/jobs` | `POST /v1/jobs` |
| `POST /api/jobs/{id}/complete` | `POST /v1/jobs/{id}/complete-upload` |
| `GET /api/jobs/{id}` | `GET /v1/jobs/{id}` |

Web forwards `X-Job-Token` and client IP headers to Go.

## Future public API

When selling the API: attach a Dokploy domain to `api`, add API-key auth and per-key rate tiers. Keep `/v1` paths stable so the web app continues to use the same handlers.
