FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* VERSION* ./
# service.sh writes VERSION from `git describe --tags --abbrev=0` before building.
# A build started without it still succeeds, and says so.
RUN [ -f VERSION ] || echo unknown > VERSION
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# git: the entrypoint reads the last tag from the repository the compose file
# mounts at /host/.git, so the version is made at every start; the baked file
# below is what it falls back to when no repository is mounted.
RUN apk add --no-cache tini openssl git
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/VERSION ./VERSION
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
