#!/bin/sh
# The version this API serves, made here at every start, whatever launched the
# stack and whether or not anything ran before it. In order: the last tag of the
# repository when its .git is mounted at /host/.git, the file service.sh wrote
# when manager-api/ is mounted at /host/manager-api, the file baked into the
# image, and "unknown" as the last word. Nothing here is ever a reason not to
# start.
#
# The file is then written back to the host, manager-api/VERSION, owned by
# whoever owns that directory, so it exists after the first start even when
# nothing created it before. A directory of that name is what Docker leaves
# behind when a compose file once bind-mounted the file before it existed: it
# is removed, it can be nothing else.
set -u

HOST_GIT=/host/.git
HOST_DIR=/host/manager-api
version=""

if [ -e "$HOST_GIT" ]; then
	version="$(git -c safe.directory='*' --git-dir="$HOST_GIT" describe --tags --abbrev=0 2>/dev/null || true)"
fi
if [ -z "$version" ] && [ -f "$HOST_DIR/VERSION" ]; then
	version="$(head -n 1 "$HOST_DIR/VERSION" 2>/dev/null | tr -d '[:space:]')"
fi
if [ -z "$version" ] && [ -f /app/VERSION ]; then
	version="$(head -n 1 /app/VERSION 2>/dev/null | tr -d '[:space:]')"
fi
[ -n "$version" ] || version=unknown

printf '%s\n' "$version" >/app/VERSION

if [ -d "$HOST_DIR" ]; then
	[ -d "$HOST_DIR/VERSION" ] && rm -rf "$HOST_DIR/VERSION"
	if [ "$version" != unknown ] || [ ! -f "$HOST_DIR/VERSION" ]; then
		if printf '%s\n' "$version" >"$HOST_DIR/VERSION" 2>/dev/null; then
			chown "$(stat -c '%u:%g' "$HOST_DIR")" "$HOST_DIR/VERSION" 2>/dev/null || true
		fi
	fi
fi

echo "code version: $version"
exec "$@"
