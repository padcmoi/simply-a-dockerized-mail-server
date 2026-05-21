# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
ENV NPM_CONFIG_MINIMUM_RELEASE_AGE=0
COPY package.json pnpm-lock.yaml* .npmrc* ./
# --ignore-scripts skips build scripts of transitive deps (esbuild, parcel/watcher, ...) which
# pnpm 10 requires explicit approval for. We don't need their native bindings recompiled - the
# npm packages ship prebuilt binaries. nuxt prepare is re-run in the dev/builder stage.
RUN pnpm install --frozen-lockfile --ignore-scripts --config.minimum-release-age=0 \
  || pnpm install --no-frozen-lockfile --ignore-scripts --config.minimum-release-age=0

FROM deps AS dev
COPY . .
RUN pnpm exec nuxt prepare
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

FROM deps AS builder
COPY . .
RUN pnpm exec nuxt prepare && pnpm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
