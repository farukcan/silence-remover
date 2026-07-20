import { NextResponse } from "next/server";
import { extractClientIp, getJob } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = request.headers.get("x-job-token") ?? "";
    if (!token) {
      return NextResponse.json({ error: "missing job token" }, { status: 401 });
    }
    const job = await getJob(id, token, extractClientIp(request));
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to load job";
    const status =
      message.includes("missing") || message.includes("invalid")
        ? 401
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
