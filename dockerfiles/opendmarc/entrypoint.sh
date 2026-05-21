#!/bin/sh
set -eu

if [ -d /etc/opendmarc-config ]; then
  cp -Rf /etc/opendmarc-config/. /etc/opendmarc/ 2>/dev/null || true
fi

mkdir -p /var/opendmarc
chown -R opendmarc:opendmarc /var/opendmarc 2>/dev/null || true

exec /usr/sbin/opendmarc -f -c /etc/opendmarc/opendmarc.conf -p inet:8893@0.0.0.0
