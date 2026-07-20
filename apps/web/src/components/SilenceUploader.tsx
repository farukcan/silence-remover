"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JobStatus =
  | "idle"
  | "creating"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

type CreateJobResponse = {
  job_id: string;
  token: string;
  upload_url: string;
};

type JobResponse = {
  job_id: string;
  status: string;
  download_url?: string;
  error?: string;
};

const ACCEPT =
  ".mp3,.wav,.m4a,.aac,.flac,.ogg,.wma,.mp4,.mov,.mkv,.webm,.avi,.m4v,audio/*,video/*";

export function SilenceUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "creating":
        return "Creating job…";
      case "uploading":
        return "Uploading…";
      case "queued":
        return "Queued…";
      case "processing":
        return "Cutting silence…";
      case "completed":
        return "Ready";
      case "failed":
        return "Failed";
      default:
        return "Waiting for a file";
    }
  }, [status]);

  useEffect(() => {
    if (!jobId || !["queued", "processing"].includes(status)) return;

    const token = sessionStorage.getItem(`job-token:${jobId}`);
    if (!token) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          headers: { "X-Job-Token": token },
        });
        const data = (await res.json()) as JobResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "status check failed");
        if (cancelled) return;

        if (data.status === "completed") {
          setStatus("completed");
          setDownloadUrl(data.download_url ?? null);
          return;
        }
        if (data.status === "failed") {
          setStatus("failed");
          setError(data.error ?? "Processing failed");
          return;
        }
        setStatus(data.status === "processing" ? "processing" : "queued");
      } catch (err) {
        if (!cancelled) {
          setStatus("failed");
          setError(err instanceof Error ? err.message : "status check failed");
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId, status]);

  async function run(selected: File) {
    setFile(selected);
    setError(null);
    setDownloadUrl(null);
    setJobId(null);
    setStatus("creating");

    try {
      const createRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selected.name,
          content_type: selected.type || "application/octet-stream",
        }),
      });
      const created = (await createRes.json()) as CreateJobResponse & {
        error?: string;
      };
      if (!createRes.ok) throw new Error(created.error ?? "create failed");

      sessionStorage.setItem(`job-token:${created.job_id}`, created.token);
      setJobId(created.job_id);
      setStatus("uploading");

      const uploadRes = await fetch(created.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": selected.type || "application/octet-stream",
        },
        body: selected,
      });
      if (!uploadRes.ok) throw new Error("upload to storage failed");

      const completeRes = await fetch(`/api/jobs/${created.job_id}/complete`, {
        method: "POST",
        headers: { "X-Job-Token": created.token },
      });
      const completed = (await completeRes.json()) as { error?: string };
      if (!completeRes.ok) throw new Error(completed.error ?? "enqueue failed");

      setStatus("queued");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "unexpected error");
    }
  }

  function onFiles(files: FileList | null) {
    const next = files?.[0];
    if (next) void run(next);
  }

  return (
    <section className="uploader">
      <div
        className={`dropzone ${dragOver ? "dropzone--active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <p className="dropzone__kicker">Drop audio or video</p>
        <p className="dropzone__title">Cut the dead air</p>
        <p className="dropzone__hint">
          Silero VAD finds speech. ffmpeg jump-cuts the rest.
        </p>
        <span className="dropzone__cta">Choose file</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <div className="status-panel" aria-live="polite">
        <div className="status-row">
          <span className="status-dot" data-state={status} />
          <strong>{statusLabel}</strong>
        </div>
        {file ? <p className="status-file">{file.name}</p> : null}
        {jobId ? <p className="status-meta">Job {jobId.slice(0, 8)}</p> : null}
        {error ? <p className="status-error">{error}</p> : null}
        {downloadUrl ? (
          <a className="download" href={downloadUrl}>
            Download tightened file
          </a>
        ) : null}
      </div>
    </section>
  );
}
