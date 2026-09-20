FROM alpine:3.24

RUN apk add --no-cache \
      bash \
      ca-certificates \
      clamav \
      clamav-daemon \
      clamav-libunrar \
      netcat-openbsd \
      python3 \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/* \
    && mkdir -p /var/run/clamav /var/lib/clamav /var/log/clamav \
    && chown -R clamav:clamav /var/run/clamav /var/lib/clamav /var/log/clamav

COPY clamd.conf /etc/clamav/clamd.conf
COPY freshclam.conf /etc/clamav/freshclam.conf
COPY clamav-api.py /usr/local/bin/clamav-api.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/clamav-api.py

EXPOSE 3310

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["sh", "-c", "python3 /usr/local/bin/clamav-api.py & exec clamd --foreground --config-file=/etc/clamav/clamd.conf"]
