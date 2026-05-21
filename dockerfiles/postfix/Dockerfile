FROM alpine:3.20

# Pinned : alpine 3.20 ships postfix 3.9.x, postfix-mysql, postfix-pcre.
# Reason for custom : the upstream Docker Hub has no official postfix image
# that exposes both postfix-mysql AND postfix-pcre with a writable bind-mount config.

# Pre-create users with FIXED UIDs - LMTP/SASL unix sockets shared with dovecot
# require matching postfix UID on both containers (and matching vmail for the maildir).
RUN addgroup -g 102 postfix \
  && adduser -D -u 102 -G postfix -s /sbin/nologin -h /var/spool/postfix postfix \
  && addgroup -g 5000 vmail \
  && adduser -D -u 5000 -G vmail -s /sbin/nologin -h /var/mail vmail

RUN apk add --no-cache \
    postfix postfix-mysql postfix-pcre \
    ca-certificates tzdata bash

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 25 465 587
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
