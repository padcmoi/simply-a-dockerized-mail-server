#!/bin/sh
# Watch the bind-mounted Let's Encrypt cert dir for changes and exit the
# container when the cert rotates so docker's restart policy brings postfix
# back with the fresh TLS files loaded. Lives entirely inside the container,
# never touches the host. The host certbot rotates the cert, the bind mount
# reflects the new files instantly, inotifywait sees the rename event and we
# fire `kill -TERM 1` so tini shuts down postfix and the container exits.
set -eu
: "${TLS_CERT_NAME:?TLS_CERT_NAME is required}"

CERT_DIR="/etc/letsencrypt/live/${TLS_CERT_NAME}"
TAG="cert-watcher[postfix]"
log() { printf "%s %s\n" "$TAG" "$*"; }

# Wait for the cert dir to appear. install.sh blocks already, but the
# container should still survive a host where the cert is provisioned later.
while [ ! -d "$CERT_DIR" ]; do
  sleep 5
done

log "watching $CERT_DIR, will restart container on rotation"
while inotifywait -q -e close_write,moved_to,create,delete "$CERT_DIR" >/dev/null; do
  # certbot atomically swaps multiple files in quick succession; wait once
  # before triggering so one rotation triggers exactly one restart.
  sleep 3
  if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    log "cert rotation detected, restarting container (kill -TERM 1)"
    kill -TERM 1
    exit 0
  fi
done
