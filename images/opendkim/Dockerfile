FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      gettext \
      opendkim \
      opendkim-utils \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/opendkim.conf /etc/opendkim-template.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8891

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["opendkim", "-f", "-x", "/etc/opendkim/opendkim.conf"]
