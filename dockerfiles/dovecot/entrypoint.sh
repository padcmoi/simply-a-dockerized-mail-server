#!/bin/bash
set -euo pipefail

# Hydrated config bind-mounted RO at /etc/dovecot-config -> copy to /etc/dovecot
if [[ -d /etc/dovecot-config ]]; then
  cp -Rf /etc/dovecot-config/. /etc/dovecot/ || true
fi

chown -R vmail:dovecot /etc/dovecot 2>/dev/null || true
chmod -R o-rwx /etc/dovecot 2>/dev/null || true

mkdir -p /var/mail/vhosts
chown -R vmail:vmail /var/mail

# Shared spool with postfix - both containers must have postfix:postfix (UID 100)
mkdir -p /var/spool/postfix/private /var/spool/postfix/public
chown -R postfix:postfix /var/spool/postfix
chmod 700 /var/spool/postfix/private

# Compile sieve scripts (idempotent)
for sieve in \
  /etc/dovecot/sieve-before/10-spam.sieve \
  /etc/dovecot/sieve-after/10-spam.sieve \
  /etc/dovecot/sieve/default.sieve \
  /etc/dovecot/sieve/report-spam.sieve \
  /etc/dovecot/sieve/report-ham.sieve
do
  [[ -f "$sieve" ]] && sievec "$sieve" 2>/dev/null || true
done

exec /usr/sbin/dovecot -F
