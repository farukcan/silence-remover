import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn, sentrySharedOptions } from "./lib/sentry";

const dsn = resolveSentryDsn();
if (dsn) {
  Sentry.init({
    ...sentrySharedOptions(),
    dsn,
    initialScope: {
      tags: { service: "web-client" },
    },
  });
}
