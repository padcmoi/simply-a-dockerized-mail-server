#!/bin/sh
# Pigeonhole sieve :pipe entry point. Invoked by learn-spam.sieve and
# learn-ham.sieve with argv:
#   $1 = "spam" | "ham"
#   $2 = recipient address (the IMAP user)
# Stdin = full message (RFC822).
#
# This script is a thin orchestrator: it parses the message once and then
# delegates each piece of business logic to a dedicated hook under hooks/.
# Hooks are run in lexical order (10-, 20-, ...) so the suffix conveys both
# the concern and the execution order:
#   10-bayes.sh             train rspamd's per-user bayes classifier
#   20-user-blocklist.sh    INCR/DEL the per-recipient spam_count counter
#   30-global-blocklist.sh  SADD/SREM the cross-user reporters set
#   40-notify.sh            one-shot postmaster notification at threshold
#
# Adding a new hook = drop a new NN-name.sh in hooks/. Removing a feature =
# rm the hook file. No other code change needed.

set -eu

# Pigeonhole :pipe invokes us with an empty environment, so doveadm/rspamc/
# redis-cli would not be reachable without a PATH.
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="${1-}"
USER="${2-}"

if [ -z "$ACTION" ] || [ -z "$USER" ]; then
	echo "sa-learn-pipe: missing args (action=$ACTION user=$USER)" >&2
	exit 0
fi

case "$ACTION" in
spam | ham) ;;
*)
	echo "sa-learn-pipe: unknown action $ACTION" >&2
	exit 0
	;;
esac

# Shared connection / policy env for all hooks. Hooks read these but never
# override them; orchestrator-level tuning lives here.
export RSPAMD_HOST="${RSPAMD_HOST:-mail-rspamd}"
export RSPAMD_PORT="${RSPAMD_PORT:-11334}"
export REDIS_HOST="${REDIS_HOST:-mail-redis}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export BLOCKLIST_TTL="${BLOCKLIST_TTL:-15552000}"
export BLOCKLIST_THRESHOLD="${BLOCKLIST_THRESHOLD:-3}"

MESSAGE_FILE="$(mktemp)"
trap 'rm -f "$MESSAGE_FILE"' EXIT
cat - >"$MESSAGE_FILE"

# Extract the first From: header, then the bare address inside any "...<x@y>"
# brackets (or take the line as-is when no brackets are present).
FROM_LINE="$(awk 'BEGIN{IGNORECASE=1} /^from:/ {sub(/^[Ff]rom:[ \t]*/, ""); print; exit}' "$MESSAGE_FILE")"
case "$FROM_LINE" in
*"<"*">"*) FROM_ADDR="$(printf '%s' "$FROM_LINE" | sed -n 's/.*<\([^>]*\)>.*/\1/p')" ;;
*) FROM_ADDR="$(printf '%s' "$FROM_LINE" | tr -d ' \t\r\n')" ;;
esac
FROM_ADDR="$(printf '%s' "$FROM_ADDR" | tr '[:upper:]' '[:lower:]')"
USER_LC="$(printf '%s' "$USER" | tr '[:upper:]' '[:lower:]')"

# Hooks live next to this script.
SCRIPT_DIR="$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")"
HOOKS_DIR="${SCRIPT_DIR}/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
	echo "sa-learn-pipe: hooks dir missing: $HOOKS_DIR" >&2
	exit 0
fi

# Run every hook in lexical order. Each hook is responsible for its own
# action/no-op decision and must never abort the chain on failure.
for hook in "$HOOKS_DIR"/*.sh; do
	[ -f "$hook" ] || continue
	[ -x "$hook" ] || continue
	"$hook" "$ACTION" "$USER_LC" "$FROM_ADDR" "$MESSAGE_FILE" || true
done

exit 0
