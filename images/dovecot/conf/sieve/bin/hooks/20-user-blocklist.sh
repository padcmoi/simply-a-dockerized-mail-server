#!/bin/sh
# Maintain the per-recipient blocklist counter consumed by the
# USER_BLOCKLIST rule in rspamd.local.lua. spam = INCR + TTL; ham = DEL.
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="$1"
USER="$2"
FROM="$3"

[ -n "$FROM" ] || exit 0
KEY="spam_count:${USER}:${FROM}"

case "$ACTION" in
  spam)
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INCR "$KEY" >/dev/null || true
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" EXPIRE "$KEY" "$BLOCKLIST_TTL" >/dev/null || true
    ;;
  ham)
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "$KEY" >/dev/null || true
    ;;
esac
exit 0
