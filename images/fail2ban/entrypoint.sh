#!/usr/bin/env bash
set -euo pipefail

: "${FAIL2BAN_MAXRETRY:=5}"
: "${FAIL2BAN_FINDTIME:=300}"
: "${FAIL2BAN_BANTIME:=3600}"
export FAIL2BAN_MAXRETRY FAIL2BAN_FINDTIME FAIL2BAN_BANTIME

CONF_DIR=/etc/fail2ban
mkdir -p "$CONF_DIR"
for src in /etc/fail2ban-templates/*.local; do
  [ -f "$src" ] && envsubst < "$src" > "$CONF_DIR/$(basename "$src")"
done

mkdir -p /var/run/fail2ban /var/lib/fail2ban
exec "$@"
