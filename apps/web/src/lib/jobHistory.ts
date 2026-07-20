/** Client-side job access history (localStorage). Tokens stay in the browser only. */

export const JOB_HISTORY_KEY = "silence-remover:jobs";
export const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

export type StoredJob = {
  jobId: string;
  token: string;
  filename: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Last known: output still downloadable. */
  downloadable: boolean;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadJobHistory(): StoredJob[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(JOB_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredJob[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const kept = parsed
      .filter((j) => j?.jobId && j?.token)
      .filter((j) => {
        const t = Date.parse(j.createdAt);
        return Number.isFinite(t) && now - t < JOB_RETENTION_MS;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (kept.length !== parsed.length) {
      saveJobHistory(kept);
    }
    return kept;
  } catch {
    return [];
  }
}

export function saveJobHistory(jobs: StoredJob[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(JOB_HISTORY_KEY, JSON.stringify(jobs.slice(0, 50)));
}

export function upsertJob(entry: StoredJob): StoredJob[] {
  const jobs = loadJobHistory().filter((j) => j.jobId !== entry.jobId);
  jobs.unshift(entry);
  saveJobHistory(jobs);
  return jobs;
}

export function removeJob(jobId: string): StoredJob[] {
  const jobs = loadJobHistory().filter((j) => j.jobId !== jobId);
  saveJobHistory(jobs);
  return jobs;
}

export function getJobToken(jobId: string): string | null {
  return loadJobHistory().find((j) => j.jobId === jobId)?.token ?? null;
}
