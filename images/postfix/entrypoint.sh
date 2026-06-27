#!/usr/bin/env bash
# Render postfix config from env then run postfix in the foreground.
set -euo pipefail

TEMPLATE_DIR=/etc/postfix-templates
CONF_DIR=/etc/postfix

: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${MAIL_PUBLIC_IP:?MAIL_PUBLIC_IP is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${TLS_CERT_NAME:?TLS_CERT_NAME is required}"
export DB_HOST="${DB_HOST:-mail-mariadb}"

mkdir -p "$CONF_DIR/sql"
# Only substitute these exact vars so postfix's own $vars are left untouched.
SUBST='${MAIL_HOSTNAME} ${MAIL_PUBLIC_IP} ${TLS_CERT_NAME} ${DB_HOST} ${DB_NAME} ${DB_USER} ${DB_PASSWORD}'
while IFS= read -r -d '' src; do
  rel="${src#$TEMPLATE_DIR/}"
  dst="$CONF_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  envsubst "$SUBST" < "$src" > "$dst"
done < <(find "$TEMPLATE_DIR" -type f -print0)

# System aliases bare minimum.
if [ ! -f "$CONF_DIR/aliases" ]; then
  cat > "$CONF_DIR/aliases" <<EOF
postmaster: root
mailer-daemon: root
EOF
fi
newaliases >/dev/null 2>&1 || true

chown -R postfix:postfix /var/spool/postfix 2>/dev/null || true

mkdir -p /var/log/mail
touch /var/log/mail/postfix.log
chown -R postfix:postfix /var/log/mail
tail -F /var/log/mail/postfix.log 2>/dev/null &

exec "$@"
