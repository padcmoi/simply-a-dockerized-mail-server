#!/bin/sh
# Watch the bind-mounted Let's Encrypt cert dir for changes and exit the
# container when the cert rotates so docker's restart policy brings dovecot
# back with the fresh TLS files loaded. Lives entirely inside the container,
# never touches the host. The host certbot rotates the cert, the bind mount
# reflects the new files instantly, inotifywait sees the rename event and we
# fire `kill -TERM 1` so tini shuts down dovecot and the container exits.
set -eu
: "${TLS_CERT_NAME:?TLS_CERT_NAME is required}"

CERT_DIR="/etc/letsencrypt/live/${TLS_CERT_NAME}"
TAG="cert-watcher[dovecot]"
log() { printf "%s %s\n" "$TAG" "$*"; }

while [ ! -d "$CERT_DIR" ]; do
  sleep 5
done

log "watching $CERT_DIR, will restart container on rotation"
while inotifywait -q -e close_write,moved_to,create,delete "$CERT_DIR" >/dev/null; do
  sleep 3
  if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    log "cert rotation detected, restarting container (kill -TERM 1)"
    kill -TERM 1
    exit 0
  fi
done
