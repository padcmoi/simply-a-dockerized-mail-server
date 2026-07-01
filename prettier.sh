#!/usr/bin/env bash
set -euo pipefail

echo "==> pnpm format in manager-api"
(cd /var/docker/simply-a-dockerized-mail-server/manager-api && pnpm format)

echo "==> pnpm format in manager-ui"
(cd /var/docker/simply-a-dockerized-mail-server/manager-ui && pnpm format)
