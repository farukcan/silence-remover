import { NextResponse } from "next/server";
import { createJob, extractClientIp } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      filename?: string;
      content_type?: string;
    };
    if (!body.filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }
    const job = await createJob(
      body.filename,
      body.content_type ?? "application/octet-stream",
      extractClientIp(request),
    );
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to create job";
    const status = message.includes("limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
