#!/bin/sh
set -eu

# Hydrated configs at /etc/opendkim-config (RO bind-mount) -> copy into /etc/opendkim
if [ -d /etc/opendkim-config ]; then
  cp -Rf /etc/opendkim-config/. /etc/opendkim/ || true
fi

mkdir -p /etc/opendkim/keys
chown -R opendkim:opendkim /etc/opendkim 2>/dev/null || true
chmod -R go-w /etc/opendkim 2>/dev/null || true

exec /usr/sbin/opendkim -f -x /etc/opendkim/opendkim.conf -p inet:12301@0.0.0.0
