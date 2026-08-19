# syntax=docker/dockerfile:1

# Multi-stage so the runtime image carries no build toolchain and no source.
# better-sqlite3 is a native module, so the builder needs python3 and a C++
# toolchain that the runtime deliberately does not.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Standalone output bundles only the files the server actually reaches.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN groupadd -r app && useradd -r -g app app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The database and the executed-agreement PDFs are the two things that must
# outlive the container. Mount a volume here.
RUN mkdir -p /data/contracts && chown -R app:app /data /app
VOLUME ["/data"]
ENV DB_PATH=/data/trademyshow.db CONTRACTS_DIR=/data/contracts

USER app
EXPOSE 3000

# Fails the container when the app stops serving, so an orchestrator restarts
# it rather than routing traffic into a dead process.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
