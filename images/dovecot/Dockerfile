FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      gettext \
      inotify-tools \
      openssl \
      dovecot \
      dovecot-mysql \
      dovecot-lmtpd \
      dovecot-pigeonhole-plugin \
      redis \
      rspamd-client \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/* \
    && addgroup -g 5000 -S vmail \
    && adduser -u 5000 -S -G vmail -h /var/mail -s /sbin/nologin vmail \
    && mkdir -p /var/mail/vhosts \
    && chown -R vmail:vmail /var/mail

COPY conf/ /etc/dovecot-templates/
COPY entrypoint.sh /entrypoint.sh
COPY cert-watcher.sh /usr/local/bin/cert-watcher.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/cert-watcher.sh

# Bake a 2048-bit dhparam at build time so the entrypoint never has to
# generate one on first boot. On a slow VPS this used to take 20-90s,
# pushing dovecot past the healthcheck grace period and tripping
# `dependency failed to start: container mail-dovecot is unhealthy`. The
# entrypoint still regenerates dh.pem if it ever becomes empty (defence
# in depth), but the default path is "already there".
RUN mkdir -p /etc/dovecot && openssl dhparam -out /etc/dovecot/dh.pem 2048 2>/dev/null

EXPOSE 24 143 993 4190 12340 12345

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["dovecot", "-F"]
