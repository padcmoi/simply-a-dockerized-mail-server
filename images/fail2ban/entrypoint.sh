#!/usr/bin/env bash
set -euo pipefail

: "${FAIL2BAN_MAXRETRY:=5}"
: "${FAIL2BAN_FINDTIME:=300}"
: "${FAIL2BAN_BANTIME:=3600}"
export FAIL2BAN_MAXRETRY FAIL2BAN_FINDTIME FAIL2BAN_BANTIME

CONF_DIR=/etc/fail2ban
mkdir -p "$CONF_DIR"
for src in /etc/fail2ban-templates/*.local; do
	[ -f "$src" ] && envsubst <"$src" >"$CONF_DIR/$(basename "$src")"
done

mkdir -p /var/run/fail2ban /var/lib/fail2ban

# Wait for postfix and dovecot to have created their log files. They share
# the bind-mounted /var/log/mail directory and the mount is read-only here,
# so we cannot pre-touch the files ourselves. fail2ban refuses to boot when
# an enabled jail points at a missing logpath and otherwise enters a
# restart loop on a fresh stack startup (every CI run).
for f in /var/log/mail/postfix.log /var/log/mail/dovecot.log; do
	T=60
	until [ -f "$f" ] || [ "$T" -le 0 ]; do
		sleep 1
		T=$((T - 1))
	done
done

exec "$@"
