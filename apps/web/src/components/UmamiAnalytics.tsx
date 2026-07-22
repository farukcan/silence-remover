"use client";

import { useEffect } from "react";
import { flushUmamiQueue } from "@/lib/umami";

/**
 * Flushes queued custom events once the Umami tracker attaches to window.
 * The tracker itself must be a parser-inserted <script defer> (see layout)
 * because Umami reads document.currentScript — next/script breaks that.
 */
export function UmamiReady() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.umami) {
      flushUmamiQueue();
      return;
    }

    const started = Date.now();
    const id = window.setInterval(() => {
      if (window.umami) {
        flushUmamiQueue();
        window.clearInterval(id);
        return;
      }
      if (Date.now() - started > 15_000) {
        window.clearInterval(id);
      }
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
