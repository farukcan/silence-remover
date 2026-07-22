"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getJobToken,
  loadJobHistory,
  removeJob,
  type StoredJob,
  upsertJob,
} from "@/lib/jobHistory";
import { durationProps, fileExt, track } from "@/lib/umami";

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
  preview_original_url?: string;
  preview_processed_url?: string;
  input_duration_sec?: number;
  output_duration_sec?: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
};

type CompareState = {
  jobId: string;
  filename: string;
  downloadUrl: string;
  originalUrl: string;
  processedUrl: string;
  inputSec: number | null;
  outputSec: number | null;
  isVideo: boolean;
};

const ACCEPT =
  ".mp3,.wav,.m4a,.aac,.flac,.ogg,.wma,.mp4,.mov,.mkv,.webm,.avi,.m4v,audio/*,video/*";

const VIDEO_EXT = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".avi",
  ".m4v",
]);

function friendlyStatus(status: string): string {
  switch (status) {
    case "creating":
      return "Getting ready…";
    case "uploading":
      return "Uploading…";
    case "queued":
      return "In line…";
    case "pending_upload":
      return "Upload incomplete";
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

function isVideoFilename(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return VIDEO_EXT.has(name.slice(dot).toLowerCase());
}

/** Classify create-job rate limit errors (daily vs concurrent). */
function rateLimitKind(
  message: string,
  status?: number,
): "daily" | "concurrent" | null {
  const lower = message.toLowerCase();
  if (lower.includes("concurrent")) return "concurrent";
  if (lower.includes("daily") || lower.includes("limit reached")) return "daily";
  if (status === 429) return "daily";
  return null;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function compareFromJob(data: JobResponse, fallbackName: string): CompareState | null {
  if (!data.preview_processed_url || !data.download_url) return null;
  const filename = data.original_filename || fallbackName || "file";
  return {
    jobId: data.job_id,
    filename,
    downloadUrl: data.download_url,
    originalUrl: data.preview_original_url || "",
    processedUrl: data.preview_processed_url,
    inputSec:
      typeof data.input_duration_sec === "number" ? data.input_duration_sec : null,
    outputSec:
      typeof data.output_duration_sec === "number" ? data.output_duration_sec : null,
    isVideo: isVideoFilename(filename),
  };
}

function downloadFilename(original?: string) {
  const base = (original || "silence-removed").trim() || "silence-removed";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return `${base}-cut`;
  return `${base.slice(0, dot)}-cut${base.slice(dot)}`;
}

/** Fetch the processed file directly from R2 (presigned attachment URL). */
async function downloadFromR2(url: string, originalName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed. Try again.");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disposition);
  const name = match
    ? decodeURIComponent(match[1] || match[2])
    : downloadFilename(originalName);
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
  const originalRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const processedRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
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
  const [compare, setCompare] = useState<CompareState | null>(null);
  const [inputKey, setInputKey] = useState(0);
  /** Avoid duplicate Umami outcome events when overlapping poll ticks finish. */
  const trackedOutcomeRef = useRef<string | null>(null);
  /** One preview_played per job+pane (avoids play/pause spam). */
  const trackedPreviewRef = useRef<Set<string>>(new Set());

  const statusLabel = useMemo(() => friendlyStatus(status), [status]);

  const stats = useMemo(() => {
    if (!compare || compare.inputSec == null || compare.outputSec == null) {
      return null;
    }
    const removed = Math.max(0, compare.inputSec - compare.outputSec);
    const pct =
      compare.inputSec > 0 ? Math.round((removed / compare.inputSec) * 100) : 0;
    return {
      before: formatDuration(compare.inputSec),
      after: formatDuration(compare.outputSec),
      removedSec: Math.round(removed),
      pct,
    };
  }, [compare]);

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
          setCompare(compareFromJob(data, filename));
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
          if (downloadable && trackedOutcomeRef.current !== `completed:${jobId}`) {
            trackedOutcomeRef.current = `completed:${jobId}`;
            track("job_completed", {
              file_ext: fileExt(filename),
              is_video: isVideoFilename(filename),
              ...durationProps(data.input_duration_sec, data.output_duration_sec),
            });
          }
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
          if (trackedOutcomeRef.current !== `failed:${jobId}`) {
            trackedOutcomeRef.current = `failed:${jobId}`;
            track("job_failed", {
              reason: "processing",
              file_ext: fileExt(filename),
            });
          }
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
          if (trackedOutcomeRef.current !== `failed:${jobId}`) {
            trackedOutcomeRef.current = `failed:${jobId}`;
            track("job_failed", { reason: "poll" });
          }
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
    setCompare(null);
    setJobId(null);
    setStatus("creating");
    trackedOutcomeRef.current = null;
    trackedPreviewRef.current = new Set();

    const ext = fileExt(selected.name);
    const isVideo = isVideoFilename(selected.name);
    track("upload_started", {
      file_ext: ext,
      is_video: isVideo,
    });

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
        const message = created.error ?? "Couldn’t start. Try again.";
        const kind = rateLimitKind(message, createRes.status);
        if (kind) {
          track("rate_limit_hit", { kind });
          setStatus("failed");
          setError(message);
          track("job_failed", { reason: "rate_limit", file_ext: ext });
          return;
        }
        throw new Error(message);
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
      track("job_queued", { file_ext: ext, is_video: isVideo });
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Something went wrong");
      track("job_failed", { reason: "upload", file_ext: ext });
    }
  }

  async function handleDownload(targetJobId?: string) {
    const id = targetJobId ?? jobId ?? compare?.jobId;
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
      // Refresh a short-lived R2 download URL, then pull the file directly from R2.
      const res = await fetch(`/api/jobs/${id}`, {
        headers: { "X-Job-Token": token },
      });
      const data = (await res.json()) as JobResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Download failed. Try again.");
      if (!data.download_url) {
        throw new Error("This file is no longer available.");
      }
      const next = compareFromJob(data, data.original_filename || compare?.filename || "file");
      if (next) setCompare(next);
      track("download_clicked", {
        file_ext: fileExt(data.original_filename || compare?.filename || "file"),
        is_video: isVideoFilename(
          data.original_filename || compare?.filename || "file",
        ),
        ...durationProps(data.input_duration_sec, data.output_duration_sec),
      });
      await downloadFromR2(
        data.download_url,
        data.original_filename || compare?.filename || "file",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Download failed. Try again.";
      setError(message);
      const existing = loadJobHistory().find((j) => j.jobId === id);
      track("download_failed", {
        file_ext: fileExt(compare?.filename || existing?.filename || "file"),
      });
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
      if (id === jobId) {
        setReady(false);
        setCompare(null);
      }
    } finally {
      setDownloading(false);
      setDownloadingId(null);
    }
  }

  async function openHistoryCompare(entry: StoredJob) {
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${entry.jobId}`, {
        headers: { "X-Job-Token": entry.token },
      });
      const data = (await res.json()) as JobResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn’t open this file.");
      const next = compareFromJob(data, entry.filename);
      if (!next) {
        setHistory(
          upsertJob({
            ...entry,
            status: "expired",
            downloadable: false,
            updatedAt: new Date().toISOString(),
          }),
        );
        throw new Error("This file is no longer available.");
      }
      setJobId(entry.jobId);
      setFile(null);
      setStatus("completed");
      setReady(true);
      setCompare(next);
      setHistory(
        upsertJob({
          ...entry,
          filename: next.filename,
          status: "completed",
          downloadable: true,
          updatedAt: new Date().toISOString(),
        }),
      );
      track("history_opened", {
        file_ext: fileExt(next.filename),
        is_video: next.isVideo,
        ...durationProps(next.inputSec, next.outputSec),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t open this file.");
    }
  }

  function onFiles(files: FileList | null) {
    const next = files?.[0];
    if (next) void run(next);
  }

  function pauseOther(which: "original" | "processed") {
    const other = which === "original" ? processedRef.current : originalRef.current;
    other?.pause();
  }

  function onPreviewPlay(which: "original" | "processed") {
    pauseOther(which);
    if (!compare) return;
    const key = `${compare.jobId}:${which}`;
    if (trackedPreviewRef.current.has(key)) return;
    trackedPreviewRef.current.add(key);
    track("preview_played", {
      which,
      file_ext: fileExt(compare.filename),
      is_video: compare.isVideo,
      ...durationProps(compare.inputSec, compare.outputSec),
    });
  }

  const busy = ["creating", "uploading", "queued", "processing"].includes(status);
  const recent = history.filter((j) => j.jobId !== jobId || status === "idle");

  return (
    <section className="uploader">
      <div
        className={`dropzone ${dragOver ? "dropzone--active" : ""} ${busy ? "dropzone--busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (busy) return;
          inputRef.current?.click();
        }}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <p className="dropzone__kicker">Drop audio or video</p>
        <p className="dropzone__title">Cut the dead air</p>
        <p className="dropzone__hint">
          {busy
            ? "Hang tight — finish this file before starting another."
            : "We keep the talking and trim the quiet parts."}
        </p>
        <span className="dropzone__cta">
          {busy ? "Working…" : ready || status === "failed" ? "Choose another file" : "Choose file"}
        </span>
        <input
          key={inputKey}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          disabled={busy}
          onChange={(e) => {
            onFiles(e.target.files);
            // Remount input so the same file can be chosen again (onChange must fire).
            setInputKey((k) => k + 1);
          }}
        />
      </div>

      <div className="status-panel" aria-live="polite">
        <div className="status-row">
          <span className="status-dot" data-state={status} />
          <strong>{statusLabel}</strong>
        </div>
        {(file || compare) ? (
          <p className="status-file">{file?.name ?? compare?.filename}</p>
        ) : null}
        {jobId ? <p className="status-meta">Ref {jobId.slice(0, 8)}</p> : null}
        {error ? <p className="status-error">{error}</p> : null}

        {ready && compare ? (
          <div className="result">
            {stats ? (
              <div className="result__stats" aria-label="Duration change">
                <span>
                  {stats.before} → {stats.after}
                </span>
                <span className="result__saved">
                  {stats.removedSec}s shorter ({stats.pct}%)
                </span>
              </div>
            ) : null}

            <div className="compare">
              <div className="compare__pane">
                <p className="compare__label">Before</p>
                {compare.originalUrl ? (
                  compare.isVideo ? (
                    <video
                      ref={(el) => {
                        originalRef.current = el;
                      }}
                      className="compare__media"
                      src={compare.originalUrl}
                      controls
                      playsInline
                      preload="metadata"
                      onPlay={() => onPreviewPlay("original")}
                    />
                  ) : (
                    <audio
                      ref={(el) => {
                        originalRef.current = el;
                      }}
                      className="compare__media"
                      src={compare.originalUrl}
                      controls
                      preload="metadata"
                      onPlay={() => onPreviewPlay("original")}
                    />
                  )
                ) : (
                  <p className="compare__missing">Original preview unavailable</p>
                )}
              </div>
              <div className="compare__pane">
                <p className="compare__label">After</p>
                {compare.isVideo ? (
                  <video
                    ref={(el) => {
                      processedRef.current = el;
                    }}
                    className="compare__media"
                    src={compare.processedUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onPlay={() => onPreviewPlay("processed")}
                  />
                ) : (
                  <audio
                    ref={(el) => {
                      processedRef.current = el;
                    }}
                    className="compare__media"
                    src={compare.processedUrl}
                    controls
                    preload="metadata"
                    onPlay={() => onPreviewPlay("processed")}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              className="download"
              onClick={() => void handleDownload(compare.jobId)}
              disabled={downloading}
            >
              {downloading && downloadingId === compare.jobId
                ? "Downloading…"
                : "Download your file"}
            </button>
          </div>
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
                  <div className="history__actions">
                    <button
                      type="button"
                      className="history__secondary"
                      onClick={() => void openHistoryCompare(item)}
                    >
                      Compare
                    </button>
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
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
