#!/bin/sh
set -eu

if [ -d /etc/opendmarc-config ]; then
  cp -Rf /etc/opendmarc-config/. /etc/opendmarc/ 2>/dev/null || true
fi

mkdir -p /var/opendmarc /var/opendmarc/etc /var/run/opendmarc
# Required data files referenced by opendmarc.conf - opendmarc refuses to start
# if they're declared but unreadable. Empty files are a valid no-op.
touch /var/opendmarc/etc/whitelist.domains /var/opendmarc/etc/ignore.hosts /var/opendmarc/opendmarc.dat
chown -R opendmarc:mail /var/opendmarc /var/run/opendmarc 2>/dev/null || true

exec /usr/sbin/opendmarc -f -c /etc/opendmarc/opendmarc.conf -p inet:8893@0.0.0.0
