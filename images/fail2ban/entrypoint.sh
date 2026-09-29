#!/usr/bin/env bash
set -euo pipefail

: "${FAIL2BAN_MAXRETRY:=5}"
: "${FAIL2BAN_FINDTIME:=300}"
: "${FAIL2BAN_BANTIME:=3600}"
: "${FAIL2BAN_BANTIME_MAX:=604800}"
: "${FAIL2BAN_ABUSE_MAXRETRY:=10}"
: "${FAIL2BAN_BOT_MAXRETRY:=1}"
: "${FAIL2BAN_DB_PURGE_AGE:=604800}"
export FAIL2BAN_MAXRETRY FAIL2BAN_FINDTIME FAIL2BAN_BANTIME
export FAIL2BAN_BANTIME_MAX FAIL2BAN_ABUSE_MAXRETRY FAIL2BAN_BOT_MAXRETRY FAIL2BAN_DB_PURGE_AGE

CONF_DIR=/etc/fail2ban
mkdir -p "$CONF_DIR"
for src in /etc/fail2ban-templates/*.local; do
	[ -f "$src" ] && envsubst <"$src" >"$CONF_DIR/$(basename "$src")"
done

mkdir -p /var/run/fail2ban /var/lib/fail2ban
touch /var/lib/fail2ban/fail2ban.log
mkdir -p /var/log/roundcube /var/lib/fail2ban/roundcube-deny
touch /var/log/roundcube/failures.log
chmod 0666 /var/log/roundcube/failures.log
chmod 0644 /var/lib/fail2ban/fail2ban.log
tail -F /var/lib/fail2ban/fail2ban.log 2>/dev/null &

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

/usr/local/bin/fail2ban-rules.py || echo "fail2ban-rules: the jail rules could not be published" >&2
/usr/local/bin/log-rotate.sh &

exec "$@"
