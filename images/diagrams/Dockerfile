FROM alpine:3.22

RUN apk add --no-cache bash coreutils plantuml graphviz imagemagick imagemagick-jpeg inotify-tools font-dejavu fontconfig \
	&& fc-cache -f

ENV PLANTUML_LIMIT_SIZE=16384 \
	JPEG_QUALITY=92

COPY render.sh /usr/local/bin/render.sh
RUN chmod +x /usr/local/bin/render.sh

WORKDIR /docs
ENTRYPOINT ["/usr/local/bin/render.sh"]
CMD ["watch"]
