/**
 * Sanitize a public origin from env (Dokploy/UI often leaves trailing spaces
 * that break the host into punycode like umami.puhulab.xn--com%20...).
 */
export function sanitizePublicOrigin(
  raw: string | undefined,
  fallback: string,
): string {
  const cleaned = (raw ?? "").replace(/[\s\u00a0\u200b]+/g, "").replace(/\/+$/, "");
  if (!cleaned) return fallback;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export function sanitizeWebsiteId(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? "").replace(/[\s\u00a0\u200b]+/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(cleaned)) return fallback;
  return cleaned;
}
