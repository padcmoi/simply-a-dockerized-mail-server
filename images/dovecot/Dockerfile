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

EXPOSE 24 143 993 4190 12340 12345

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["dovecot", "-F"]
