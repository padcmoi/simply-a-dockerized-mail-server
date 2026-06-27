#!/usr/bin/env bash
# Let's Encrypt deploy hook for simply-mailserver.
#
# Installed at /etc/letsencrypt/renewal-hooks/deploy/simply-mailserver by
# install.sh. certbot invokes every script in that directory once per
# successful renewal (and only on successful renewal: no-op renewals do not
# trigger it), with two env vars set:
#
#   RENEWED_LINEAGE  = /etc/letsencrypt/live/<cert-name>   (no trailing slash)
#   RENEWED_DOMAINS  = space-separated list of FQDNs covered by the cert
#
# We only act if the renewed lineage matches THIS stack's TLS_CERT_NAME (read
# from the project .env), so other stacks sharing the same host certbot do
# not accidentally cause this stack to restart.
set -euo pipefail

PROJECT_DIR="__PROJECT_DIR__"
LOG_TAG="letsencrypt-hook[simply-mailserver]"
log() { logger -t "$LOG_TAG" "$*" 2>/dev/null || true; printf '%s %s\n' "$LOG_TAG" "$*" >&2; }

ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "skip: $ENV_FILE not found"
  exit 0
fi

TLS_CERT_NAME=$(grep -E '^TLS_CERT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2-)
if [ -z "$TLS_CERT_NAME" ]; then
  log "skip: TLS_CERT_NAME not set in $ENV_FILE"
  exit 0
fi

EXPECTED="/etc/letsencrypt/live/${TLS_CERT_NAME}"
RENEWED="${RENEWED_LINEAGE:-}"
EXPECTED="${EXPECTED%/}"
RENEWED="${RENEWED%/}"

if [ "$RENEWED" != "$EXPECTED" ]; then
  log "skip: renewed=$RENEWED, expected=$EXPECTED"
  exit 0
fi

# Stamp the cert's notBefore so we know exactly which cert we restarted onto.
NOT_BEFORE=$(openssl x509 -in "${EXPECTED}/fullchain.pem" -noout -startdate 2>/dev/null | cut -d= -f2- || true)
log "cert renewed for ${TLS_CERT_NAME} (notBefore=${NOT_BEFORE:-unknown}); restarting dovecot + postfix"

cd "$PROJECT_DIR"
docker compose restart dovecot postfix
log "restart complete"
