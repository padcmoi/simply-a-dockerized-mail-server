#!/usr/bin/env bash
# Render dovecot config from env, ensure ownership, then launch.
set -euo pipefail

TEMPLATE_DIR=/etc/dovecot-templates
CONF_DIR=/etc/dovecot

: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${TLS_CERT_NAME:?TLS_CERT_NAME is required}"
export DB_HOST="${DB_HOST:-mail-mariadb}"

mkdir -p "$CONF_DIR/conf.d"
SUBST='${MAIL_HOSTNAME} ${TLS_CERT_NAME} ${DB_HOST} ${DB_NAME} ${DB_USER} ${DB_PASSWORD}'
while IFS= read -r -d '' src; do
	rel="${src#$TEMPLATE_DIR/}"
	dst="$CONF_DIR/$rel"
	mkdir -p "$(dirname "$dst")"
	envsubst "$SUBST" <"$src" >"$dst"
done < <(find "$TEMPLATE_DIR" -type f -print0)

mkdir -p /var/mail/vhosts
chown -R vmail:vmail /var/mail

# Install global sieve scripts (compile each .sieve to .svbin).
mkdir -p /var/lib/dovecot/sieve/global
cp -f /etc/dovecot/sieve/*.sieve /var/lib/dovecot/sieve/global/ 2>/dev/null || true
for s in /var/lib/dovecot/sieve/global/*.sieve; do
	[ -f "$s" ] && sievec "$s" 2>/dev/null || true
done
chown -R vmail:vmail /var/lib/dovecot

# Install :pipe binaries used by learn-spam.sieve / learn-ham.sieve and the
# auto-route.sieve / auto-route-undo.sieve pair. The directory matches
# sieve_pipe_bin_dir in 90-sieve.conf. Each orchestrator delegates to its
# own per-concern hooks dir.
mkdir -p /usr/local/lib/dovecot/sieve/hooks \
	/usr/local/lib/dovecot/sieve/auto-route-hooks \
	/usr/local/lib/dovecot/sieve/auto-route-undo-hooks
cp -f /etc/dovecot/sieve/bin/*.sh /usr/local/lib/dovecot/sieve/ 2>/dev/null || true
cp -f /etc/dovecot/sieve/bin/hooks/*.sh /usr/local/lib/dovecot/sieve/hooks/ 2>/dev/null || true
cp -f /etc/dovecot/sieve/bin/auto-route-hooks/*.sh /usr/local/lib/dovecot/sieve/auto-route-hooks/ 2>/dev/null || true
cp -f /etc/dovecot/sieve/bin/auto-route-undo-hooks/*.sh /usr/local/lib/dovecot/sieve/auto-route-undo-hooks/ 2>/dev/null || true
find /usr/local/lib/dovecot/sieve -type f -name '*.sh' -exec chmod +x {} +

if [ ! -s /etc/dovecot/dh.pem ]; then
	openssl dhparam -out /etc/dovecot/dh.pem 2048 >/dev/null 2>&1 || true
fi

mkdir -p /var/log/mail
touch /var/log/mail/dovecot.log
chown -R vmail:vmail /var/log/mail
chmod 0666 /var/log/mail/dovecot.log
tail -F /var/log/mail/dovecot.log 2>/dev/null &

# Watch the bind-mounted Let's Encrypt cert dir; when it rotates we kill
# PID 1 so docker's restart policy brings dovecot back with the new cert.
/usr/local/bin/cert-watcher.sh &

exec "$@"
