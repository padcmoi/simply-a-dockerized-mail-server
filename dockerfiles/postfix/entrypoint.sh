#!/bin/bash
set -euo pipefail

# Hydrated config bind-mounted RO at /etc/postfix-config -> copy to /etc/postfix
if [[ -d /etc/postfix-config ]]; then
  cp -Rf /etc/postfix-config/. /etc/postfix/
fi

# Make sure the spool layout exists (first-boot or fresh volume)
mkdir -p /var/spool/postfix/private /var/spool/postfix/public /var/spool/postfix/maildrop
chown -R postfix:postfix /var/spool/postfix
chmod 700 /var/spool/postfix/private
chmod 730 /var/spool/postfix/maildrop

# `postfix check` regenerates the postfix daemon table indexes if needed
postfix check 2>/dev/null || true

# rsyslog isn't on alpine slim - postfix logs to stderr by default which docker captures.
# Run postfix in the foreground (daemonized by master).
postfix start

# Keep PID 1 alive and tail mail.log so `docker logs` shows mail activity
touch /var/log/mail.log
exec tail -F /var/log/mail.log
