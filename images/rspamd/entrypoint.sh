#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_DIR=/etc/rspamd-templates
CONF_DIR=/etc/rspamd

: "${RSPAMD_PASSWORD:?RSPAMD_PASSWORD is required}"
export RSPAMD_PASSWORD_HASH="$(rspamadm pw -p "$RSPAMD_PASSWORD" 2>/dev/null || echo "$RSPAMD_PASSWORD")"

mkdir -p "$CONF_DIR/local.d" "$CONF_DIR/override.d"
SUBST='${RSPAMD_PASSWORD_HASH}'
while IFS= read -r -d '' src; do
  rel="${src#$TEMPLATE_DIR/}"
  dst="$CONF_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  envsubst "$SUBST" < "$src" > "$dst"
done < <(find "$TEMPLATE_DIR" -type f -print0)

mkdir -p /var/lib/rspamd /var/log/rspamd
chown -R rspamd:rspamd /var/lib/rspamd /var/log/rspamd /etc/rspamd

exec "$@"
