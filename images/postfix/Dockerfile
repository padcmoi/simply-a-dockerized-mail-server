FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      gettext \
      inotify-tools \
      jq \
      postfix \
      postfix-mysql \
      postfix-pcre \
      postfix-policyd-spf-perl \
      cyrus-sasl \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/ /etc/postfix-templates/
COPY bounce/ /etc/postfix-bounce/
COPY entrypoint.sh /entrypoint.sh
COPY cert-watcher.sh /usr/local/bin/cert-watcher.sh
COPY log-rotate.sh /usr/local/bin/log-rotate.sh
COPY settings-watcher.sh /usr/local/bin/settings-watcher.sh
COPY command-watcher.sh /usr/local/bin/command-watcher.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/cert-watcher.sh /usr/local/bin/log-rotate.sh /usr/local/bin/settings-watcher.sh /usr/local/bin/command-watcher.sh

EXPOSE 25 465 587

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["postfix", "start-fg"]
