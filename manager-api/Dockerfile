# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
# openssl is used by Sha512CryptService to hash webadmin passwords (matches Dovecot scheme).
RUN corepack enable && apk add --no-cache openssl

FROM base AS deps
ENV NPM_CONFIG_MINIMUM_RELEASE_AGE=0
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile --ignore-scripts --config.minimum-release-age=0 \
  || pnpm install --no-frozen-lockfile --ignore-scripts --config.minimum-release-age=0

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

FROM deps AS builder
COPY . .
RUN pnpm run build

FROM base AS prod-deps
ENV NPM_CONFIG_MINIMUM_RELEASE_AGE=0
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --config.minimum-release-age=0 \
  || pnpm install --prod --ignore-scripts --no-frozen-lockfile --config.minimum-release-age=0

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
