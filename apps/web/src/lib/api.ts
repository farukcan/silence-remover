const API_BASE = process.env.API_INTERNAL_URL ?? "http://api:8080";

export type CreateJobResponse = {
  job_id: string;
  token: string;
  upload_url: string;
  input_key: string;
  expires_in_sec: number;
};

export type JobResponse = {
  job_id: string;
  status: string;
  original_filename: string;
  download_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || "request failed";
  }
}

function forwardHeaders(extra?: HeadersInit, clientIp?: string): Headers {
  const headers = new Headers(extra);
  if (clientIp) {
    headers.set("X-Forwarded-For", clientIp);
    headers.set("X-Real-IP", clientIp);
  }
  return headers;
}

export async function createJob(
  filename: string,
  contentType: string,
  clientIp?: string,
) {
  const res = await fetch(`${API_BASE}/v1/jobs`, {
    method: "POST",
    headers: forwardHeaders(
      { "Content-Type": "application/json" },
      clientIp,
    ),
    body: JSON.stringify({ filename, content_type: contentType }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as CreateJobResponse;
}

export async function completeUpload(
  jobId: string,
  token: string,
  clientIp?: string,
) {
  const res = await fetch(`${API_BASE}/v1/jobs/${jobId}/complete-upload`, {
    method: "POST",
    headers: forwardHeaders({ "X-Job-Token": token }, clientIp),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as { job_id: string; status: string };
}

export async function getJob(jobId: string, token: string, clientIp?: string) {
  const res = await fetch(`${API_BASE}/v1/jobs/${jobId}`, {
    headers: forwardHeaders({ "X-Job-Token": token }, clientIp),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as JobResponse;
}

export function extractClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    // Prefer the last hop (set by the edge proxy) over the spoofable first value.
    return parts[parts.length - 1] || "unknown";
  }
  return "unknown";
}
