import { NextResponse } from "next/server";
import { completeUpload, extractClientIp } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = request.headers.get("x-job-token") ?? "";
    if (!token) {
      return NextResponse.json({ error: "missing job token" }, { status: 401 });
    }
    const result = await completeUpload(id, token, extractClientIp(request));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to enqueue job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
