#!/bin/sh
LOG_DIR="/var/log/mail"
LOG_FILE="${LOG_DIR}/postfix.log"
STAMP="${LOG_DIR}/.postfix.log.rotated"
KEEP_DAYS=30
TAG="log-rotate[postfix]"

log() { printf "%s %s\n" "$TAG" "$*"; }

while :; do
	today="$(date +%Y%m%d)"
	if [ "$(cat "$STAMP" 2>/dev/null)" != "$today" ]; then
		if [ -s "$LOG_FILE" ]; then
			if postfix logrotate >/dev/null 2>&1; then
				touch "$LOG_FILE"
				chown postfix:postfix "$LOG_FILE"
				chmod 0666 "$LOG_FILE"
				log "rotated $LOG_FILE"
			else
				log "postfix logrotate failed, retrying in an hour"
				sleep 3600
				continue
			fi
		fi
		echo "$today" >"$STAMP"
	fi
	find "$LOG_DIR" -maxdepth 1 -type f -name 'postfix.log.*' -mtime +"$KEEP_DAYS" -delete
	sleep 3600
done
