#!/usr/bin/env bash
# Render opendmarc.conf, refresh PSL weekly, prepare data files.
set -euo pipefail

: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${DMARC_REJECT_FAILURES:=false}"
export DMARC_REJECT_FAILURES

CONF_DIR=/etc/opendmarc
DATA_DIR=/var/lib/opendmarc
mkdir -p "$CONF_DIR" "$DATA_DIR"

envsubst '${MAIL_HOSTNAME} ${DMARC_REJECT_FAILURES}' < /etc/opendmarc-template.conf > "$CONF_DIR/opendmarc.conf"

PSL="$DATA_DIR/public_suffix_list.dat"
if [ ! -s "$PSL" ] || [ "$(find "$PSL" -mtime +7 2>/dev/null)" ]; then
  curl -fsSL --max-time 30 \
    -o "$PSL" \
    https://publicsuffix.org/list/public_suffix_list.dat \
    || echo "warn: failed to fetch PSL, keeping existing copy" >&2
fi

: > "$DATA_DIR/opendmarc.dat"
[ -f "$DATA_DIR/ignore.hosts" ]     || : > "$DATA_DIR/ignore.hosts"
[ -f "$DATA_DIR/whitelist.domains" ] || : > "$DATA_DIR/whitelist.domains"

mkdir -p /var/run/opendmarc
chown -R opendmarc:opendmarc "$CONF_DIR" "$DATA_DIR" /var/run/opendmarc

exec "$@"
