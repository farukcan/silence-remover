"use client";

import Script from "next/script";
import { flushUmamiQueue } from "@/lib/umami";

/**
 * Loads the Umami tracker when both public env vars are set.
 * Omit them locally to keep development traffic out of analytics.
 * NEXT_PUBLIC_* must be present at Docker image build time.
 */
export function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_UMAMI_URL?.replace(/\/$/, "").trim();

  if (!websiteId || !baseUrl) {
    return null;
  }

  return (
    <Script
      src={`${baseUrl}/script.js`}
      data-website-id={websiteId}
      data-do-not-track="true"
      strategy="afterInteractive"
      onLoad={flushUmamiQueue}
    />
  );
}
