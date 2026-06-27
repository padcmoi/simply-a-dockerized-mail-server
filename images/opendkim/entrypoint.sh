#!/usr/bin/env bash
# Render opendkim.conf and ensure per-domain key tables exist on the data volume.
set -euo pipefail

: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"

CONF_DIR=/etc/opendkim
mkdir -p "$CONF_DIR/keys"
envsubst '${MAIL_HOSTNAME}' < /etc/opendkim-template.conf > "$CONF_DIR/opendkim.conf"

[ -f "$CONF_DIR/key.table" ]     || : > "$CONF_DIR/key.table"
[ -f "$CONF_DIR/signing.table" ] || : > "$CONF_DIR/signing.table"
if [ ! -f "$CONF_DIR/trusted.hosts" ]; then
  cat > "$CONF_DIR/trusted.hosts" <<EOF
127.0.0.1
::1
localhost
${MAIL_HOSTNAME}
172.200.0.0/24
EOF
fi

chown -R opendkim:opendkim "$CONF_DIR"
chmod 700 "$CONF_DIR/keys" 2>/dev/null || true

mkdir -p /var/run/opendkim
chown -R opendkim:opendkim /var/run/opendkim

exec "$@"
