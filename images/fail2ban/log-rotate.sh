#!/bin/sh
KEEP_DAYS=30
TAG="log-rotate[fail2ban]"

log() { printf "%s %s\n" "$TAG" "$*"; }

rotate() {
	file="$1"
	mode="$2"
	reopen="$3"
	stamp="$(dirname "$file")/.$(basename "$file").rotated"
	today="$(date +%Y%m%d)"
	if [ "$(cat "$stamp" 2>/dev/null)" != "$today" ]; then
		if [ -s "$file" ]; then
			rotated="${file}.$(date +%Y%m%d-%H%M%S)"
			if ! mv "$file" "$rotated"; then
				log "mv $file failed, retrying in an hour"
				return
			fi
			touch "$file"
			chmod "$mode" "$file"
			[ -z "$reopen" ] || $reopen >/dev/null 2>&1 || log "$reopen failed"
			sleep 1
			gzip "$rotated" || log "gzip $rotated failed"
			log "rotated $file"
		fi
		echo "$today" >"$stamp"
	fi
	find "$(dirname "$file")" -maxdepth 1 -type f -name "$(basename "$file").*" -mtime +"$KEEP_DAYS" -delete
}

T=120
until fail2ban-client ping >/dev/null 2>&1 || [ "$T" -le 0 ]; do
	sleep 1
	T=$((T - 1))
done

while :; do
	rotate /var/lib/fail2ban/fail2ban.log 0644 "fail2ban-client flushlogs"
	rotate /var/log/roundcube/failures.log 0666 ""
	sleep 3600
done
