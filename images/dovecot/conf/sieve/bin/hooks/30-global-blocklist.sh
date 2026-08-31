#!/bin/sh
# Maintain the cross-user reporters set consumed by the GLOBAL_BLOCKLIST
# rule in rspamd.local.lua. spam = SADD + TTL; ham = SREM (the user
# withdraws their vote so they no longer count toward the consensus).
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="$1"
USER="$2"
FROM="$3"

[ -n "$FROM" ] || exit 0
KEY="senders:${FROM}:reporters"

case "$ACTION" in
spam)
	redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SADD "$KEY" "$USER" >/dev/null || true
	redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" EXPIRE "$KEY" "$BLOCKLIST_TTL" >/dev/null || true
	;;
ham)
	redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SREM "$KEY" "$USER" >/dev/null || true
	;;
esac
exit 0
