"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getJobToken,
  loadJobHistory,
  removeJob,
  type StoredJob,
  upsertJob,
} from "@/lib/jobHistory";

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
  original_filename?: string;
  download_url?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
};

const ACCEPT =
  ".mp3,.wav,.m4a,.aac,.flac,.ogg,.wma,.mp4,.mov,.mkv,.webm,.avi,.m4v,audio/*,video/*";

function friendlyStatus(status: string): string {
  switch (status) {
    case "creating":
      return "Getting ready…";
    case "uploading":
      return "Uploading…";
    case "queued":
      return "In line…";
    case "processing":
      return "Removing silence…";
    case "completed":
      return "Ready";
    case "failed":
      return "Something went wrong";
    case "expired":
      return "Expired";
    default:
      return "Waiting for a file";
  }
}

async function downloadJobFile(jobId: string, token: string): Promise<void> {
  const res = await fetch(`/api/jobs/${jobId}/download`, {
    headers: { "X-Job-Token": token },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Download failed. Try again.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disposition);
  const name = match
    ? decodeURIComponent(match[1] || match[2])
    : "silence-removed-cut";
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function SilenceUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<StoredJob[]>([]);
  const [historyReady, setHistoryReady] = useState(false);

  const statusLabel = useMemo(() => friendlyStatus(status), [status]);

  const refreshHistoryEntry = useCallback(async (entry: StoredJob) => {
    try {
      const res = await fetch(`/api/jobs/${entry.jobId}`, {
        headers: { "X-Job-Token": entry.token },
      });
      const data = (await res.json()) as JobResponse & { error?: string };
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          setHistory(removeJob(entry.jobId));
        }
        return;
      }
      const downloadable =
        data.status === "completed" && Boolean(data.download_url);
      const next: StoredJob = {
        ...entry,
        filename: data.original_filename || entry.filename,
        status: downloadable
          ? "completed"
          : data.status === "completed"
            ? "expired"
            : data.status,
        updatedAt: data.updated_at || new Date().toISOString(),
        downloadable,
      };
      setHistory(upsertJob(next));
    } catch {
      // Keep cached entry; network blips should not wipe history.
    }
  }, []);

  useEffect(() => {
    const loaded = loadJobHistory();
    setHistory(loaded);
    setHistoryReady(true);
    for (const entry of loaded) {
      void refreshHistoryEntry(entry);
    }
  }, [refreshHistoryEntry]);

  useEffect(() => {
    if (!jobId || !["queued", "processing"].includes(status)) return;

    const token = getJobToken(jobId);
    if (!token) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          headers: { "X-Job-Token": token },
        });
        const data = (await res.json()) as JobResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Couldn’t check status.");
        if (cancelled) return;

        const filename = data.original_filename || file?.name || "file";
        if (data.status === "completed") {
          const downloadable = Boolean(data.download_url);
          setStatus("completed");
          setReady(downloadable);
          setHistory(
            upsertJob({
              jobId,
              token,
              filename,
              status: downloadable ? "completed" : "expired",
              createdAt: data.created_at || new Date().toISOString(),
              updatedAt: data.updated_at || new Date().toISOString(),
              downloadable,
            }),
          );
          return;
        }
        if (data.status === "failed") {
          setStatus("failed");
          setError(data.error ?? "Couldn’t finish this file. Try again.");
          setHistory(
            upsertJob({
              jobId,
              token,
              filename,
              status: "failed",
              createdAt: data.created_at || new Date().toISOString(),
              updatedAt: data.updated_at || new Date().toISOString(),
              downloadable: false,
            }),
          );
          return;
        }
        const nextStatus =
          data.status === "processing" ? "processing" : "queued";
        setStatus(nextStatus);
        setHistory(
          upsertJob({
            jobId,
            token,
            filename,
            status: nextStatus,
            createdAt: data.created_at || new Date().toISOString(),
            updatedAt: data.updated_at || new Date().toISOString(),
            downloadable: false,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setStatus("failed");
          setError(
            err instanceof Error ? err.message : "Something went wrong. Try again.",
          );
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId, status, file?.name]);

  async function run(selected: File) {
    setFile(selected);
    setError(null);
    setReady(false);
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
      if (!createRes.ok) {
        throw new Error(created.error ?? "Couldn’t start. Try again.");
      }

      const createdAt = new Date().toISOString();
      setHistory(
        upsertJob({
          jobId: created.job_id,
          token: created.token,
          filename: selected.name,
          status: "uploading",
          createdAt,
          updatedAt: createdAt,
          downloadable: false,
        }),
      );
      setJobId(created.job_id);
      setStatus("uploading");

      const uploadRes = await fetch(created.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: selected,
      });
      if (!uploadRes.ok) throw new Error("Upload failed. Try again.");

      const completeRes = await fetch(`/api/jobs/${created.job_id}/complete`, {
        method: "POST",
        headers: { "X-Job-Token": created.token },
      });
      const completed = (await completeRes.json()) as { error?: string };
      if (!completeRes.ok) {
        throw new Error(completed.error ?? "Couldn’t start processing. Try again.");
      }

      setHistory(
        upsertJob({
          jobId: created.job_id,
          token: created.token,
          filename: selected.name,
          status: "queued",
          createdAt,
          updatedAt: new Date().toISOString(),
          downloadable: false,
        }),
      );
      setStatus("queued");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDownload(targetJobId?: string) {
    const id = targetJobId ?? jobId;
    if (!id || downloading) return;
    const token = getJobToken(id);
    if (!token) {
      setError("This file is no longer available on this device.");
      return;
    }
    setDownloading(true);
    setDownloadingId(id);
    setError(null);
    try {
      await downloadJobFile(id, token);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Download failed. Try again.";
      setError(message);
      const existing = loadJobHistory().find((j) => j.jobId === id);
      if (existing) {
        setHistory(
          upsertJob({
            ...existing,
            status: "expired",
            downloadable: false,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      if (id === jobId) setReady(false);
    } finally {
      setDownloading(false);
      setDownloadingId(null);
    }
  }

  function onFiles(files: FileList | null) {
    const next = files?.[0];
    if (next) void run(next);
  }

  const recent = history.filter((j) => j.jobId !== jobId || status === "idle");

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
          We keep the talking and trim the quiet parts.
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
        {jobId ? <p className="status-meta">Ref {jobId.slice(0, 8)}</p> : null}
        {error ? <p className="status-error">{error}</p> : null}
        {ready ? (
          <button
            type="button"
            className="download"
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            {downloading && downloadingId === jobId
              ? "Downloading…"
              : "Download your file"}
          </button>
        ) : null}
      </div>

      {historyReady && recent.length > 0 ? (
        <div className="history">
          <h3 className="history__title">Your recent files</h3>
          <p className="history__hint">
            Saved on this device for 1 day. Cleared if you wipe browser data.
          </p>
          <ul className="history__list">
            {recent.map((item) => (
              <li key={item.jobId} className="history__item">
                <div className="history__meta">
                  <span className="history__name" title={item.filename}>
                    {item.filename}
                  </span>
                  <span className="history__status">
                    {friendlyStatus(item.status)}
                  </span>
                </div>
                {item.downloadable ? (
                  <button
                    type="button"
                    className="history__download"
                    onClick={() => void handleDownload(item.jobId)}
                    disabled={downloading}
                  >
                    {downloading && downloadingId === item.jobId
                      ? "…"
                      : "Download"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
