FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      gettext \
      inotify-tools \
      postfix \
      postfix-mysql \
      postfix-pcre \
      postfix-policyd-spf-perl \
      cyrus-sasl \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/ /etc/postfix-templates/
COPY entrypoint.sh /entrypoint.sh
COPY cert-watcher.sh /usr/local/bin/cert-watcher.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/cert-watcher.sh

EXPOSE 25 465 587

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["postfix", "start-fg"]
