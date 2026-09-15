FROM alpine:3.20

RUN apk add --no-cache \
      dnssec-root \
      tini \
      tzdata \
      unbound \
    && rm -rf /var/cache/apk/* \
    && mkdir -p /var/lib/unbound \
    && chown unbound:unbound /var/lib/unbound

COPY conf/unbound.conf /etc/unbound/unbound.conf
RUN unbound-checkconf /etc/unbound/unbound.conf

EXPOSE 53/udp 53/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD unbound-control -c /etc/unbound/unbound.conf status >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["unbound", "-d", "-c", "/etc/unbound/unbound.conf"]
