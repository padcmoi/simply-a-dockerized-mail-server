FROM alpine:3.20

# Thin layer : alpine 3.20 ships opendmarc 1.4.2
RUN apk add --no-cache opendmarc ca-certificates

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8893
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
