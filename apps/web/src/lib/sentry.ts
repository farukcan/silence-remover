/**
 * Shared Bugsink (Sentry-compatible) options.
 * Bugsink is error-only — keep tracesSampleRate at 0.
 * DSN must come from env (no production default in the client bundle).
 */
export function resolveSentryDsn(): string | undefined {
  if (
    process.env.SENTRY_DISABLED === "1" ||
    process.env.NEXT_PUBLIC_SENTRY_DISABLED === "1"
  ) {
    return undefined;
  }
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function sentrySharedOptions() {
  return {
    dsn: resolveSentryDsn(),
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      "production",
    sendDefaultPii: true,
    tracesSampleRate: 0,
  } as const;
}
