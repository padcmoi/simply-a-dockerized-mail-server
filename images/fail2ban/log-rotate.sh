#!/bin/sh
LOG_DIR="/var/lib/fail2ban"
LOG_FILE="${LOG_DIR}/fail2ban.log"
STAMP="${LOG_DIR}/.fail2ban.log.rotated"
KEEP_DAYS=30
TAG="log-rotate[fail2ban]"

log() { printf "%s %s\n" "$TAG" "$*"; }

T=120
until fail2ban-client ping >/dev/null 2>&1 || [ "$T" -le 0 ]; do
	sleep 1
	T=$((T - 1))
done

while :; do
	today="$(date +%Y%m%d)"
	if [ "$(cat "$STAMP" 2>/dev/null)" != "$today" ]; then
		if [ -s "$LOG_FILE" ]; then
			rotated="${LOG_FILE}.$(date +%Y%m%d-%H%M%S)"
			if mv "$LOG_FILE" "$rotated"; then
				fail2ban-client flushlogs >/dev/null 2>&1 || log "fail2ban-client flushlogs failed"
				touch "$LOG_FILE"
				chmod 0644 "$LOG_FILE"
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
	find "$LOG_DIR" -maxdepth 1 -type f -name 'fail2ban.log.*' -mtime +"$KEEP_DAYS" -delete
	sleep 3600
done
