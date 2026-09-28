#!/bin/sh
LOG_DIR="/var/log/mail"
LOG_FILE="${LOG_DIR}/dovecot.log"
STAMP="${LOG_DIR}/.dovecot.log.rotated"
KEEP_DAYS=30
TAG="log-rotate[dovecot]"

log() { printf "%s %s\n" "$TAG" "$*"; }

while :; do
	today="$(date +%Y%m%d)"
	if [ "$(cat "$STAMP" 2>/dev/null)" != "$today" ]; then
		if [ -s "$LOG_FILE" ]; then
			rotated="${LOG_FILE}.$(date +%Y%m%d-%H%M%S)"
			if mv "$LOG_FILE" "$rotated"; then
				touch "$LOG_FILE"
				chown vmail:vmail "$LOG_FILE"
				chmod 0666 "$LOG_FILE"
				doveadm log reopen >/dev/null 2>&1 || log "doveadm log reopen failed"
				sleep 1
				gzip "$rotated" || log "gzip $rotated failed"
				log "rotated $LOG_FILE"
			else
				log "mv $LOG_FILE failed, retrying in an hour"
				sleep 3600
				continue
			fi
		fi
		echo "$today" >"$STAMP"
	fi
	find "$LOG_DIR" -maxdepth 1 -type f -name 'dovecot.log.*' -mtime +"$KEEP_DAYS" -delete
	sleep 3600
done
