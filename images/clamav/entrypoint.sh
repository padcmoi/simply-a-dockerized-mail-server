#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/run/clamav /var/lib/clamav /var/log/clamav
chown -R clamav:clamav /var/run/clamav /var/lib/clamav /var/log/clamav

if [ ! -s /var/lib/clamav/main.cvd ] && [ ! -s /var/lib/clamav/main.cld ]; then
  echo "clamav: initial signature update..." >&2
  freshclam --config-file=/etc/clamav/freshclam.conf --no-warnings || true
fi
freshclam --config-file=/etc/clamav/freshclam.conf --daemon --foreground --checks=24 &

exec "$@"
