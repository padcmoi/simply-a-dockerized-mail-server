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
COPY conf/filter.d/ /etc/fail2ban/filter.d/
COPY fail2ban-api.py /usr/local/bin/fail2ban-api.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/fail2ban-api.py

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["sh", "-c", "python3 /usr/local/bin/fail2ban-api.py & exec fail2ban-server -f -x -v"]
