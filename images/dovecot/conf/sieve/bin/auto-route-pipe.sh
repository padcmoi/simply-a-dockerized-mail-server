#!/bin/sh
# Pigeonhole sieve :pipe entry point. Invoked by auto-route.sieve with argv:
#   $1 = recipient address (the IMAP user)
#   $2 = destination mailbox (a user-created folder, system folders are
#        filtered out in the .sieve script)
# Stdin = full message (RFC822).
#
# Mirrors sa-learn-pipe.sh: parses the message once and delegates business
# logic to auto-route-hooks/*.sh. The hook upserts a fileinto rule in the
# user's managesieve script.

set -eu

export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

USER="${1-}"
DEST="${2-}"

if [ -z "$USER" ] || [ -z "$DEST" ]; then
	echo "auto-route-pipe: missing args (user=$USER dest=$DEST)" >&2
	exit 0
fi

USER_LC="$(printf '%s' "$USER" | tr '[:upper:]' '[:lower:]')"

MESSAGE_FILE="$(mktemp)"
trap 'rm -f "$MESSAGE_FILE"' EXIT
cat - >"$MESSAGE_FILE"

# Same From: extraction policy as sa-learn-pipe.sh: parse the raw header so
# Gmail's address normalisation (dot stripping) does not desync the stored
# value from what the recipient sees in their client.
FROM_LINE="$(awk 'BEGIN{IGNORECASE=1} /^from:/ {sub(/^[Ff]rom:[ \t]*/, ""); print; exit}' "$MESSAGE_FILE")"
case "$FROM_LINE" in
*"<"*">"*) FROM_ADDR="$(printf '%s' "$FROM_LINE" | sed -n 's/.*<\([^>]*\)>.*/\1/p')" ;;
*) FROM_ADDR="$(printf '%s' "$FROM_LINE" | tr -d ' \t\r\n')" ;;
esac
FROM_ADDR="$(printf '%s' "$FROM_ADDR" | tr '[:upper:]' '[:lower:]')"

if [ -z "$FROM_ADDR" ]; then
	echo "auto-route-pipe: no From: header" >&2
	exit 0
fi

case "$FROM_ADDR" in
*@*) ;;
*)
	echo "auto-route-pipe: malformed From: $FROM_ADDR" >&2
	exit 0
	;;
esac

export USER_LC FROM_ADDR DEST

SCRIPT_DIR="$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")"
HOOKS_DIR="${SCRIPT_DIR}/auto-route-hooks"

if [ ! -d "$HOOKS_DIR" ]; then
	echo "auto-route-pipe: hooks dir missing: $HOOKS_DIR" >&2
	exit 0
fi

for hook in "$HOOKS_DIR"/*.sh; do
	[ -f "$hook" ] || continue
	[ -x "$hook" ] || continue
	"$hook" "$USER_LC" "$FROM_ADDR" "$DEST" || true
done

exit 0
