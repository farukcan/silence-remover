"use client";

import * as Sentry from "@sentry/nextjs";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Chained Bugsink smoke test. Open /?bugsink_test=<BUGSINK_TEST_TOKEN>
 * Click → BFF → API → worker error → API error → frontend error.
 */
export function BugsinkSmokeTest() {
  const params = useSearchParams();
  const token = params.get("bugsink_test")?.trim() || "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!token) return null;

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/bugsink-test?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        worker_ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      Sentry.captureException(new Error("Bugsink frontend smoke test"));
      setMessage(
        data.worker_ok
          ? "Sent worker + api + frontend errors to Bugsink."
          : "API + frontend sent; worker_ok=false (check worker token/DSN).",
      );
    } catch (err) {
      Sentry.captureException(
        err instanceof Error ? err : new Error("Bugsink frontend smoke test failed"),
      );
      setMessage(err instanceof Error ? err.message : "Smoke test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <p style={{ marginTop: "1rem", textAlign: "center" }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        style={{
          background: "#3d9b7a",
          color: "#0b1110",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.55rem 0.9rem",
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Sending…" : "Send Bugsink chain test"}
      </button>
      {message ? (
        <span style={{ display: "block", marginTop: "0.5rem", opacity: 0.8 }}>
          {message}
        </span>
      ) : null}
    </p>
  );
}
