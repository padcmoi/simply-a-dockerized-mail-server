FROM alpine:3.20

# Thin layer : alpine 3.20 ships opendkim 2.11.0
RUN apk add --no-cache opendkim opendkim-utils ca-certificates

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 12301
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
