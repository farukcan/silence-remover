# Bun 1.4.4 patches the October 2026 TLS trust-store compromise (eMudhra / emSign)
# and the related protocol fixes. This image does not ship the Node.js runtime.
FROM oven/bun:1.4.4-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at build time — pass via Compose build.args / Dokploy.
ARG NEXT_PUBLIC_SITE_URL=https://silence-remover.puhulab.com
ARG NEXT_PUBLIC_UMAMI_URL=
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_DISABLED=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_UMAMI_URL=$NEXT_PUBLIC_UMAMI_URL
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DISABLED=$NEXT_PUBLIC_SENTRY_DISABLED
RUN bun --bun run build && test -f .next/standalone/server.js

FROM oven/bun:1.4.4-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=bun:bun /app/public ./public
RUN mkdir -p .next && chown bun:bun .next
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
USER bun
EXPOSE 3000
CMD ["bun", "server.js"]
