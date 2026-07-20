#!/usr/bin/env python3
"""Consume silence-removal jobs from Redis and update Postgres + S3."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from pathlib import Path

import boto3
import psycopg
import redis
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from silence_core import SilenceRemoverError, process_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

QUEUE_KEY = os.getenv("QUEUE_KEY", "jobs:silence")
DATABASE_URL = os.environ["DATABASE_URL"]
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "")
S3_REGION = os.getenv("S3_REGION", "auto")
S3_BUCKET = os.getenv("S3_BUCKET", "silence-remover")
S3_ACCESS_KEY = os.environ["S3_ACCESS_KEY"]
S3_SECRET_KEY = os.environ["S3_SECRET_KEY"]
S3_FORCE_PATH_STYLE = os.getenv("S3_FORCE_PATH_STYLE", "true").lower() in {
    "1",
    "true",
    "yes",
}
BRPOP_TIMEOUT = int(os.getenv("BRPOP_TIMEOUT", "5"))
# How long uploaded/processed objects are kept in object storage.
OBJECT_RETENTION_HOURS = int(os.getenv("OBJECT_RETENTION_HOURS", "24"))
CLEANUP_INTERVAL_SEC = int(os.getenv("CLEANUP_INTERVAL_SEC", "900"))


def s3_client():
    kwargs = {
        "service_name": "s3",
        "aws_access_key_id": S3_ACCESS_KEY,
        "aws_secret_access_key": S3_SECRET_KEY,
        "region_name": S3_REGION,
        "config": BotoConfig(s3={"addressing_style": "path" if S3_FORCE_PATH_STYLE else "auto"}),
    }
    if S3_ENDPOINT:
        kwargs["endpoint_url"] = S3_ENDPOINT
    return boto3.client(**kwargs)


def update_status(
    conn: psycopg.Connection,
    job_id: str,
    status: str,
    *,
    error: str | None = None,
    completed: bool = False,
    input_duration_sec: float | None = None,
    output_duration_sec: float | None = None,
) -> None:
    with conn.cursor() as cur:
        if completed:
            cur.execute(
                """
                UPDATE jobs
                SET status = %s,
                    error = %s,
                    input_duration_sec = COALESCE(%s, input_duration_sec),
                    output_duration_sec = COALESCE(%s, output_duration_sec),
                    updated_at = NOW(),
                    completed_at = NOW()
                WHERE id = %s
                """,
                (status, error, input_duration_sec, output_duration_sec, job_id),
            )
        else:
            cur.execute(
                """
                UPDATE jobs
                SET status = %s, error = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (status, error, job_id),
            )
    conn.commit()


def delete_object(s3, key: str) -> None:
    if not key:
        return
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
    except ClientError as exc:
        log.warning("failed to delete s3://%s/%s: %s", S3_BUCKET, key, exc)


def cleanup_expired_objects(conn: psycopg.Connection, s3) -> int:
    """Delete input/output objects older than OBJECT_RETENTION_HOURS."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, input_key, output_key
            FROM jobs
            WHERE created_at < NOW() - (%s || ' hours')::interval
              AND status IN ('completed', 'failed')
              AND (input_key <> '' OR output_key <> '')
            ORDER BY created_at ASC
            LIMIT 200
            """,
            (str(OBJECT_RETENTION_HOURS),),
        )
        rows = cur.fetchall()

    purged = 0
    for job_id, input_key, output_key in rows:
        delete_object(s3, input_key)
        delete_object(s3, output_key)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE jobs
                SET input_key = '', output_key = '', updated_at = NOW()
                WHERE id = %s
                """,
                (job_id,),
            )
        purged += 1

    if purged:
        conn.commit()
        log.info(
            "purged storage for %d job(s) older than %dh",
            purged,
            OBJECT_RETENTION_HOURS,
        )
    return purged


def process_job(conn: psycopg.Connection, s3, payload: dict) -> None:
    job_id = payload["job_id"]
    input_key = payload["input_key"]
    output_key = payload["output_key"]

    log.info("processing job %s", job_id)
    update_status(conn, job_id, "processing")

    suffix = Path(input_key).suffix or ".mp3"
    with tempfile.TemporaryDirectory(prefix="silence-job-") as tmp:
        tmp_dir = Path(tmp)
        input_path = tmp_dir / f"input{suffix}"
        output_path = tmp_dir / f"output{suffix}"

        s3.download_file(S3_BUCKET, input_key, str(input_path))

        try:
            result = process_file(input_path, output_path)
        except SilenceRemoverError as exc:
            update_status(conn, job_id, "failed", error=str(exc), completed=True)
            log.warning("job %s failed: %s", job_id, exc)
            return

        try:
            s3.upload_file(
                str(output_path),
                S3_BUCKET,
                output_key,
                ExtraArgs={
                    # Stored as binary; preview URLs override Content-Type via response headers.
                    "ContentType": "application/octet-stream",
                    "ContentDisposition": f'attachment; filename="output{suffix}"',
                },
            )
        except Exception as exc:
            update_status(
                conn,
                job_id,
                "failed",
                error=f"upload failed: {exc}",
                completed=True,
            )
            log.warning("job %s upload failed: %s", job_id, exc)
            return

        update_status(
            conn,
            job_id,
            "completed",
            completed=True,
            input_duration_sec=result.input_duration,
            output_duration_sec=result.output_duration,
        )
        log.info(
            "job %s completed (%.2fs → %.2fs)",
            job_id,
            result.input_duration,
            result.output_duration,
        )


def main() -> None:
    # socket_timeout must exceed BRPOP_TIMEOUT so an empty-queue nil reply
    # is not raced by the client socket timeout (redis-py quirk).
    rdb = redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=BRPOP_TIMEOUT + 5,
        health_check_interval=30,
    )
    s3 = s3_client()
    last_cleanup = 0.0

    log.info(
        "worker started; queue=%s retention=%dh cleanup_every=%ds",
        QUEUE_KEY,
        OBJECT_RETENTION_HOURS,
        CLEANUP_INTERVAL_SEC,
    )
    while True:
        now = time.time()
        if now - last_cleanup >= CLEANUP_INTERVAL_SEC:
            try:
                with psycopg.connect(DATABASE_URL) as conn:
                    cleanup_expired_objects(conn, s3)
            except Exception:
                log.exception("storage cleanup failed")
            last_cleanup = now

        try:
            item = rdb.brpop(QUEUE_KEY, timeout=BRPOP_TIMEOUT)
        except redis.TimeoutError:
            # Empty queue or socket race — treat as idle poll.
            continue
        except redis.ConnectionError:
            log.exception("redis connection lost; retrying")
            time.sleep(1)
            continue
        if not item:
            continue
        _, raw = item
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            log.error("invalid queue payload: %s", raw)
            continue

        try:
            with psycopg.connect(DATABASE_URL) as conn:
                process_job(conn, s3, payload)
        except Exception:
            log.exception("unexpected worker error for payload %s", payload)
            try:
                with psycopg.connect(DATABASE_URL) as conn:
                    update_status(
                        conn,
                        payload.get("job_id", ""),
                        "failed",
                        error="internal worker error",
                        completed=True,
                    )
            except Exception:
                log.exception("failed to mark job as failed")
            time.sleep(1)


if __name__ == "__main__":
    main()
