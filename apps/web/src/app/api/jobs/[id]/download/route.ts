import { NextResponse } from "next/server";
import { extractClientIp, getJob } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function downloadFilename(original?: string) {
  const base = (original || "silence-removed").trim() || "silence-removed";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return `${base}-cut`;
  return `${base.slice(0, dot)}-cut${base.slice(dot)}`;
}

function contentDisposition(filename: string) {
  // Header values must be ByteString; keep quoted filename ASCII-only.
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const fallback = ascii.trim() || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = request.headers.get("x-job-token") ?? "";
    if (!token) {
      return NextResponse.json({ error: "missing job token" }, { status: 401 });
    }

    const job = await getJob(id, token, extractClientIp(request));
    if (job.status !== "completed" || !job.download_url) {
      return NextResponse.json({ error: "download not ready" }, { status: 409 });
    }

    const upstream = await fetch(job.download_url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "failed to fetch output" }, { status: 502 });
    }

    const filename = downloadFilename(job.original_filename);
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "download failed";
    const status =
      message.includes("missing") || message.includes("invalid")
        ? 401
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
