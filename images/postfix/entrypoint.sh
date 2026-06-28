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

# Translate the user-facing megabyte limit into the byte count postfix
# expects for message_size_limit. Default 25 MB matches Gmail's cap.
ATTACHMENT_MAX_SIZE_MB="${ATTACHMENT_MAX_SIZE_MB:-25}"
export ATTACHMENT_MAX_SIZE_BYTES=$(( ATTACHMENT_MAX_SIZE_MB * 1024 * 1024 ))

mkdir -p "$CONF_DIR/sql"
# Only substitute these exact vars so postfix's own $vars are left untouched.
SUBST='${MAIL_HOSTNAME} ${MAIL_PUBLIC_IP} ${TLS_CERT_NAME} ${DB_HOST} ${DB_NAME} ${DB_USER} ${DB_PASSWORD} ${ATTACHMENT_MAX_SIZE_BYTES}'
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

# Watch the bind-mounted Let's Encrypt cert dir; when it rotates we kill
# PID 1 so docker's restart policy brings postfix back with the new cert.
/usr/local/bin/cert-watcher.sh &

exec "$@"
