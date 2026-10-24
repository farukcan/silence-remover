import { NextResponse } from "next/server";
import { internalApiFetch } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Proxies the chained Bugsink smoke test: worker → api errors.
 * Browser calls this; API is not public.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const res = await internalApiFetch(
      `/v1/__bugsink_test?token=${encodeURIComponent(token)}`,
    );
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "bugsink test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
