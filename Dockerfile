# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set basePath at build time (inlined into client bundles).
# Empty = served from the domain root. Set to e.g. "/aitools" to serve the app
# under a sub-path; the same value must also be passed to the runner as an env
# var and matched by the reverse proxy.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN npm run build

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (basePath is auto-handled by standalone output)
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# ---- Tools (one-off maintenance scripts: backfill, seed, RAG ingest) ----
# Deliberately the LAST stage and NOT on the runner's dependency chain, so
# `docker compose build app` never builds it. It carries the full source plus
# devDependencies (tsx) and skips `next build`, so it is cheap: the deps layer
# is shared with the runner and only `COPY . .` runs.
# Only reachable via the "tools" compose profile, e.g.
#   docker compose run --rm tools npx tsx scripts/backfill-token-usage.ts
FROM base AS tools
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "tsx", "scripts/backfill-token-usage.ts"]
