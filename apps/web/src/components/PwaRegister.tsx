"use client";

import { useEffect } from "react";

/** Registers the installable PWA service worker (HTTPS / localhost only). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Install still works with manifest alone on some platforms; SW is best-effort.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
