"use client";

import * as Sentry from "@sentry/nextjs";
import { useSearchParams } from "next/navigation";

/**
 * Manual Bugsink smoke test. Open /?bugsink_test=1 and click the button.
 * Browser console `throw` does NOT reach Sentry (devtools sandbox).
 */
export function BugsinkSmokeTest() {
  const params = useSearchParams();
  if (params.get("bugsink_test") !== "1") return null;

  return (
    <p style={{ marginTop: "1rem", textAlign: "center" }}>
      <button
        type="button"
        onClick={() => {
          Sentry.captureException(new Error("Bugsink frontend smoke test"));
          alert("Sent Bugsink frontend smoke test (check Issues + Network).");
        }}
        style={{
          background: "#3d9b7a",
          color: "#0b1110",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.55rem 0.9rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Send Bugsink test error
      </button>
    </p>
  );
}
