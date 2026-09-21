FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=true WRANGLER_SEND_METRICS=false GOMEMLIMIT=2GiB GOMAXPROCS=2
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production CI=true WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false MINIFLARE_REGISTRY_PATH=/tmp/dune-registry
LABEL org.opencontainers.image.source="https://github.com/Quintine/Dune"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
COPY tools/wrangler.local.json ./tools/wrangler.local.json
COPY tools/admin-access.mjs ./tools/admin-access.mjs
COPY deploy/container-entrypoint.sh ./deploy/container-entrypoint.sh
COPY deploy/serve.mjs ./deploy/serve.mjs
RUN mkdir -p /data /app/.wrangler && chown node:node /data /app/.wrangler
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/', {signal: AbortSignal.timeout(8000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "/app/deploy/container-entrypoint.sh"]
