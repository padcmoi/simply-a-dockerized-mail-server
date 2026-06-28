#!/bin/sh
# One-shot postmaster notification when the per-recipient spam_count just
# reached BLOCKLIST_THRESHOLD. Source of truth = SETNX on a notified flag,
# so we send at most one notification per (recipient, sender) pair.
#
# learn_ham removes the flag so a future re-block re-notifies.
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="$1"
USER="$2"
FROM="$3"

[ -n "$FROM" ] || exit 0
FLAG="notified:${USER}:${FROM}"

case "$ACTION" in
  ham)
    # User changed their mind: clear the flag so a future re-block re-arms
    # the notification.
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "$FLAG" >/dev/null || true
    exit 0
    ;;
  spam) ;;
  *) exit 0 ;;
esac

COUNT_KEY="spam_count:${USER}:${FROM}"
COUNT="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "$COUNT_KEY" 2>/dev/null || echo 0)"
[ "${COUNT:-0}" -ge "$BLOCKLIST_THRESHOLD" ] || exit 0

CLAIMED="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SETNX "$FLAG" 1 2>/dev/null || echo 0)"
[ "$CLAIMED" = "1" ] || exit 0
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" EXPIRE "$FLAG" "$BLOCKLIST_TTL" >/dev/null || true

USER_DOMAIN="${USER#*@}"
date_hdr="$(date -R 2>/dev/null || date)"
mid="<blocklist-notice.$$.$(date +%s 2>/dev/null || echo 0)@${USER_DOMAIN}>"

# Deliver via dovecot-lda (not doveadm save) so the full sieve pipeline
# runs on the notification: spam-to-junk in sieve_before, then the user's
# managesieve script. That way a user-crafted AUTOROUTER rule for
# postmaster@<domain> (or any custom filter) is honoured, instead of the
# notification being force-filed into INBOX behind the user's back.
/usr/libexec/dovecot/dovecot-lda -d "$USER" -f "postmaster@${USER_DOMAIN}" <<EOF
From: postmaster@${USER_DOMAIN}
To: ${USER}
Date: ${date_hdr}
Subject: Sender ${FROM} is now auto-routed to Junk
Message-ID: ${mid}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

Hello,

You have flagged messages from ${FROM} as spam ${BLOCKLIST_THRESHOLD}
times. From now on, every new message from this sender will be delivered
straight to your Junk folder.

Important: no message is ever rejected. You can still open the Junk folder
and read anything that lands there. Deleting messages from Junk (or
emptying the Trash) does NOT undo the block.

If you change your mind and want to receive ${FROM} in your Inbox again,
do this: open your Junk folder, pick any message from ${FROM}, and move
it to your Inbox (Boite de reception). That single move clears the block
immediately, and the next message from ${FROM} will land in your Inbox.

postmaster
EOF

exit 0
