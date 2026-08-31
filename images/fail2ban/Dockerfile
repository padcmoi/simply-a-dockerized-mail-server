FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      fail2ban \
      gettext \
      iptables \
      ip6tables \
      python3 \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/ /etc/fail2ban-templates/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["fail2ban-server", "-f", "-x", "-v"]
