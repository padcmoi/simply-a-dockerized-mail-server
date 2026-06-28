#!/bin/sh
# Pigeonhole sieve :pipe entry point. Invoked by auto-route-undo.sieve with
# argv:
#   $1 = recipient address (the IMAP user)
# Stdin = full message (RFC822).
#
# Mirrors auto-route-pipe.sh in structure: parses the message once and then
# delegates business logic to auto-route-undo-hooks/*.sh. The hook removes
# the AUTOROUTER rule (if any) that matches the sender, so users without
# a Filtres-capable client can drag a mail back to INBOX to undo a previous
# auto-routing.

set -eu

export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

USER="${1:-}"

if [ -z "$USER" ]; then
  echo "auto-route-undo-pipe: missing user arg" >&2
  exit 0
fi

USER_LC="$(printf '%s' "$USER" | tr '[:upper:]' '[:lower:]')"

MESSAGE_FILE="$(mktemp)"
trap 'rm -f "$MESSAGE_FILE"' EXIT
cat - > "$MESSAGE_FILE"

# Pigeonhole imap_sieve only exposes the destination mailbox in COPY events
# (`imap.mailbox` = INBOX here). The source could be any other folder, and
# the rule we must honour is: only USER-created folders (DA, DF, ...) trigger
# the AUTOROUTER removal; system folders (Drafts/Sent/Junk/Trash/Archive)
# moving back to INBOX must keep the rule, because they correspond to the
# spam unblock procedure, undelete-from-Trash, draft editing, etc.
#
# Since the source mailbox is not in the sieve environment, we recover it
# from the message itself: pigeonhole fires this trigger BEFORE the EXPUNGE
# that completes a MOVE, so the original copy still exists in its source
# mailbox alongside the new INBOX copy. We look the Message-ID up across
# every mailbox and take the non-INBOX match as the source.
MSGID="$(awk 'BEGIN{IGNORECASE=1} /^message-id:/ {sub(/^[Mm]essage-[Ii][Dd]:[ \t]*/,""); print; exit} /^$/ {exit}' "$MESSAGE_FILE" | tr -d ' \t\r\n')"

if [ -z "$MSGID" ]; then
  # Without a Message-ID we cannot identify the source; keep the rule.
  exit 0
fi

SOURCES="$(doveadm fetch -u "$USER" "mailbox" mailbox '*' header Message-ID "$MSGID" 2>/dev/null | awk '/^mailbox:/ {print $2}' | grep -vxE 'INBOX|dovecot|dovecot/sieve' || true)"

if [ -z "$SOURCES" ]; then
  # Either the move was already finalized (EXPUNGE done) or the message is
  # gone; safer to keep the rule than to delete on guesswork.
  exit 0
fi

USER_FOLDER_FOUND=0
for src in $SOURCES; do
  case "$src" in
    Drafts|Sent|Junk|Trash|Archive|Archives) ;;
    *) USER_FOLDER_FOUND=1 ;;
  esac
done

if [ "$USER_FOLDER_FOUND" -eq 0 ]; then
  # All sources are system folders. Don't delete.
  exit 0
fi

# Same From: extraction policy as auto-route-pipe.sh so the removal looks up
# the AUTOROUTER rule under the exact same key the upsert hook wrote.
FROM_LINE="$(awk 'BEGIN{IGNORECASE=1} /^from:/ {sub(/^[Ff]rom:[ \t]*/, ""); print; exit}' "$MESSAGE_FILE")"
case "$FROM_LINE" in
  *"<"*">"*) FROM_ADDR="$(printf '%s' "$FROM_LINE" | sed -n 's/.*<\([^>]*\)>.*/\1/p')" ;;
  *)         FROM_ADDR="$(printf '%s' "$FROM_LINE" | tr -d ' \t\r\n')" ;;
esac
FROM_ADDR="$(printf '%s' "$FROM_ADDR" | tr '[:upper:]' '[:lower:]')"

if [ -z "$FROM_ADDR" ]; then
  exit 0
fi

case "$FROM_ADDR" in
  *@*) ;;
  *) exit 0 ;;
esac

export USER_LC FROM_ADDR

SCRIPT_DIR="$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")"
HOOKS_DIR="${SCRIPT_DIR}/auto-route-undo-hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "auto-route-undo-pipe: hooks dir missing: $HOOKS_DIR" >&2
  exit 0
fi

for hook in "$HOOKS_DIR"/*.sh; do
  [ -f "$hook" ] || continue
  [ -x "$hook" ] || continue
  "$hook" "$USER_LC" "$FROM_ADDR" || true
done

exit 0
