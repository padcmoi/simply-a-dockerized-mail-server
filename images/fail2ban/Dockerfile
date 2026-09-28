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
COPY conf/action.d/ /etc/fail2ban/action.d/
COPY fail2ban-api.py /usr/local/bin/fail2ban-api.py
COPY mailserver-chain.sh /usr/local/bin/mailserver-chain.sh
COPY fail2ban-rules.py /usr/local/bin/fail2ban-rules.py
COPY log-rotate.sh /usr/local/bin/log-rotate.sh
COPY roundcube-deny.sh /usr/local/bin/roundcube-deny.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/fail2ban-api.py /usr/local/bin/mailserver-chain.sh \
      /usr/local/bin/fail2ban-rules.py /usr/local/bin/log-rotate.sh /usr/local/bin/roundcube-deny.sh

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["sh", "-c", "python3 /usr/local/bin/fail2ban-api.py & exec fail2ban-server -f -x -v"]
