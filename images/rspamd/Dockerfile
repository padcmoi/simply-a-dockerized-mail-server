FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      gettext \
      rspamd \
      rspamd-controller \
      rspamd-fuzzy \
      rspamd-proxy \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/ /etc/rspamd-templates/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 11332 11333 11334

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["rspamd", "-f", "-u", "rspamd", "-g", "rspamd"]
