FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      curl \
      gettext \
      opendkim \
      opendkim-utils \
      python3 \
      tini \
      tzdata \
    && rm -rf /var/cache/apk/*

COPY conf/opendkim.conf /etc/opendkim-template.conf
COPY dkim-api.py /usr/local/bin/dkim-api.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/dkim-api.py

EXPOSE 8080 8891

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["sh", "-c", "python3 /usr/local/bin/dkim-api.py & exec opendkim -f -x /etc/opendkim/opendkim.conf"]
