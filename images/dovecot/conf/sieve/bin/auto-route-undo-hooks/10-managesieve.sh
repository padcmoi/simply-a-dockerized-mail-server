#!/bin/sh
# Remove the AUTOROUTER rule (if any) bearing the given sender from the
# user's active managesieve script. Hand-crafted rules with a different
# name (e.g. "test123") are never touched, even if their body happens to
# do the same fileinto for the same sender: only the marker prefix
# `# rule:[AUTOROUTER ` is considered.
#
# Args:
#   $1 = recipient email (lower-cased)
#   $2 = sender address  (lower-cased)
#
# If the active script does not exist or contains no AUTOROUTER rule for
# this sender, the script is a clean no-op (no rewrite, no recompile).

set -eu

USER="${1:?recipient required}"
FROM="${2:?sender required}"

DOMAIN="${USER#*@}"
LOCAL="${USER%@*}"
HOME_DIR="/var/mail/vhosts/${DOMAIN}/${LOCAL}"
SIEVE_DIR="${HOME_DIR}/sieve"
ACTIVE_LINK="${HOME_DIR}/.dovecot.sieve"

ACTIVE_SCRIPT=""
if [ -L "$ACTIVE_LINK" ]; then
	target="$(readlink "$ACTIVE_LINK")"
	case "$target" in
	/*) ACTIVE_SCRIPT="$target" ;;
	*) ACTIVE_SCRIPT="${HOME_DIR}/${target}" ;;
	esac
fi

# Nothing to undo if the user never had a sieve script.
[ -n "$ACTIVE_SCRIPT" ] || exit 0
[ -f "$ACTIVE_SCRIPT" ] || exit 0

PREFIX="# rule:[AUTOROUTER "
SUFFIX=" ${FROM}]"

TMP_NORM="$(mktemp)"
TMP_NEW="$(mktemp)"

tr -d '\r' <"$ACTIVE_SCRIPT" >"$TMP_NORM"

# Fast path via awk (no regex - substr only - so a sender with regex-special
# chars like `+` does not break the match).
if ! awk -v P="$PREFIX" -v S="$SUFFIX" '
  substr($0, 1, length(P)) == P && substr($0, length($0) - length(S) + 1) == S { found = 1; exit }
  END { exit (found ? 0 : 1) }
' "$TMP_NORM"; then
	rm -f "$TMP_NORM" "$TMP_NEW"
	exit 0
fi

awk -v P="$PREFIX" -v S="$SUFFIX" '
  in_block { if ($0 == "}") { in_block = 0 }; next }
  substr($0, 1, length(P)) == P && substr($0, length($0) - length(S) + 1) == S { in_block = 1; next }
  { print }
' "$TMP_NORM" >"$TMP_NEW"

sed -i 's/$/\r/' "$TMP_NEW"

mv "$TMP_NEW" "$ACTIVE_SCRIPT"
chown vmail:vmail "$ACTIVE_SCRIPT" 2>/dev/null || true
rm -f "$TMP_NORM"

sievec "$ACTIVE_SCRIPT" >/dev/null 2>&1 || true
chown vmail:vmail "${ACTIVE_SCRIPT%.sieve}.svbin" 2>/dev/null || true

exit 0
