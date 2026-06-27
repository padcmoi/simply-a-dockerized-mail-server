FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      clamav \
      clamav-daemon \
      clamav-libunrar \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/* \
    && mkdir -p /var/run/clamav /var/lib/clamav /var/log/clamav \
    && chown -R clamav:clamav /var/run/clamav /var/lib/clamav /var/log/clamav

COPY clamd.conf /etc/clamav/clamd.conf
COPY freshclam.conf /etc/clamav/freshclam.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3310

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["clamd", "--foreground", "--config-file=/etc/clamav/clamd.conf"]
