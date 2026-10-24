import { clearOutboundProxyEnv } from "./clear-outbound-proxy";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://api.:8080";

// A single-label name such as "api" is looked up with resolv.conf search domains
// when ndots is high. On this host that turns it into api.puhulab.com (Cloudflare),
// and port 8080 is then refused. A trailing dot keeps the Docker service name.
function absoluteServiceUrl(path: string): string {
  const url = new URL(path, API_BASE);
  const host = url.hostname;
  const isIp = host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isIp || host.includes(".")) return url.toString();
  return url.toString().replace(`//${host}`, `//${host}.`);
}

// proxy: false is a second guard for this call. clearOutboundProxyEnv covers every
// other Bun fetch in the process (the option is not part of the Fetch spec).
type DirectFetchInit = RequestInit & { proxy: false };

export function internalApiFetch(path: string, init?: RequestInit): Promise<Response> {
  clearOutboundProxyEnv();
  return fetch(absoluteServiceUrl(path), {
    ...init,
    cache: "no-store",
    proxy: false,
  } as DirectFetchInit);
}

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
  preview_original_url?: string;
  preview_processed_url?: string;
  input_duration_sec?: number;
  output_duration_sec?: number;
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
  const res = await internalApiFetch("/v1/jobs", {
    method: "POST",
    headers: forwardHeaders(
      { "Content-Type": "application/json" },
      clientIp,
    ),
    body: JSON.stringify({ filename, content_type: contentType }),
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
  const res = await internalApiFetch(`/v1/jobs/${jobId}/complete-upload`, {
    method: "POST",
    headers: forwardHeaders({ "X-Job-Token": token }, clientIp),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as { job_id: string; status: string };
}

export async function getJob(jobId: string, token: string, clientIp?: string) {
  const res = await internalApiFetch(`/v1/jobs/${jobId}`, {
    headers: forwardHeaders({ "X-Job-Token": token }, clientIp),
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
