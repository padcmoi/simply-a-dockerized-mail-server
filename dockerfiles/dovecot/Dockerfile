FROM alpine:3.20

# Pinned : alpine 3.20 ships dovecot 2.3.21.x + dovecot-mysql + sieve.
# Reason for custom : the official dovecot/dovecot image does not guarantee the
# dovecot-mysql plugin in its build, and we need it for the userdb/passdb auth.

# UID alignment with postfix container - required for the shared
# /var/spool/postfix/private/{dovecot-lmtp,auth} unix sockets.
RUN addgroup -g 102 postfix \
  && adduser -D -u 102 -G postfix -s /sbin/nologin -h /var/spool/postfix postfix \
  && addgroup -g 5000 vmail \
  && adduser -D -u 5000 -G vmail -s /sbin/nologin -h /var/mail vmail

RUN apk add --no-cache \
    dovecot dovecot-mysql dovecot-lmtpd dovecot-pop3d \
    dovecot-pigeonhole-plugin \
    ca-certificates tzdata bash

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 143 993 4190
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
