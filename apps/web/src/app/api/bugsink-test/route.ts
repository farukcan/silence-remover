import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://api:8080";

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
    const res = await fetch(
      `${API_BASE}/v1/__bugsink_test?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
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
