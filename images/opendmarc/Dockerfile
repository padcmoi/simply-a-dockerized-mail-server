FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      curl \
      gettext \
      opendmarc \
      shadow \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/* \
    && (getent group opendmarc >/dev/null || addgroup -S opendmarc) \
    && (getent passwd opendmarc >/dev/null || adduser -S -G opendmarc -H -h /var/lib/opendmarc -s /sbin/nologin opendmarc)

COPY conf/opendmarc.conf /etc/opendmarc-template.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8893

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["opendmarc", "-f", "-c", "/etc/opendmarc/opendmarc.conf"]
