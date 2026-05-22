FROM alpine:3.20

# Thin layer : alpine 3.20 ships opendmarc 1.4.2. The package creates the
# `opendmarc` user (primary group `mail`). We just need to pre-create the pid dir
# with the right ownership so the daemon can write its pidfile after setuid.
RUN apk add --no-cache opendmarc ca-certificates curl \
  && mkdir -p /var/run/opendmarc /usr/share/publicsuffix \
  && curl -fsSL -o /usr/share/publicsuffix/public_suffix_list.dat \
       https://publicsuffix.org/list/public_suffix_list.dat \
  && chown opendmarc:mail /var/run/opendmarc \
  && apk del curl

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8893
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
