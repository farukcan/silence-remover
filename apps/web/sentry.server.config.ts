import * as Sentry from "@sentry/nextjs";
import { sentrySharedOptions } from "./src/lib/sentry";

Sentry.init({
  ...sentrySharedOptions(),
  initialScope: {
    tags: { service: "web-server" },
  },
});
