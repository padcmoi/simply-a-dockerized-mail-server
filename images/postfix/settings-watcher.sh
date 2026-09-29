#!/usr/bin/env bash
set -uo pipefail

SETTINGS_DIR=/var/lib/postfix-managed/settings
SETTINGS_FILE="$SETTINGS_DIR/settings.json"
STATUS_DIR=/var/lib/postfix-managed/status
STATUS_FILE="$STATUS_DIR/status.json"
TEMPLATE_DIR=/etc/postfix-bounce
CONF_DIR=/etc/postfix
BOUNCE_FILE="$CONF_DIR/bounce.cf"
BACKUP_DIR="$CONF_DIR/.managed-backup"
DOMAINS_MAP="mysql:$CONF_DIR/sql/mysql-virtual-domains.cf"
DEFAULTS='{"version":0,"bounceSenderLocal":"mailer-daemon","bounceSenderDomain":"","delayWarningHours":0,"maximalQueueLifetimeDays":3}'
TAG="settings-watcher[postfix]"

log() { printf "%s %s\n" "$TAG" "$*"; }

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

previous() { jq -r "$1 // empty" "$STATUS_FILE" 2>/dev/null; }

write_status() {
	local version="$1" applied="$2" applied_at="$3" error="$4"
	mkdir -p "$STATUS_DIR"
	jq -n \
		--argjson version "$version" \
		--argjson applied "$applied" \
		--arg appliedAt "$applied_at" \
		--arg error "$error" \
		--arg checkedAt "$(now)" \
		'{version: $version, appliedVersion: $applied, appliedAt: (if $appliedAt == "" then null else $appliedAt end), error: (if $error == "" then null else $error end), checkedAt: $checkedAt}' \
		>"$STATUS_FILE.tmp" && chmod 0644 "$STATUS_FILE.tmp" && mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

validate() {
	local file="$1" extra domain
	if ! jq -e 'type == "object"' "$file" >/dev/null 2>&1; then
		echo "the settings file is not a JSON object"
		return 1
	fi
	extra=$(jq -r 'keys - ["version","bounceSenderLocal","bounceSenderDomain","delayWarningHours","maximalQueueLifetimeDays"] | join(", ")' "$file")
	if [ -n "$extra" ]; then
		echo "unknown settings: $extra"
		return 1
	fi
	if ! jq -e '
		(.version | type == "number" and . == floor and . >= 0)
		and (.bounceSenderLocal | type == "string" and length <= 64 and test("^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$") and (test("\\.\\.") | not))
		and (.bounceSenderDomain | type == "string" and (. == "" or (length <= 253 and test("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$"))))
		and (.delayWarningHours | type == "number" and . == floor and . >= 0 and . <= 24)
		and (.maximalQueueLifetimeDays | type == "number" and . == floor and . >= 1 and . <= 5)
		and (.delayWarningHours < .maximalQueueLifetimeDays * 24)
	' "$file" >/dev/null 2>&1; then
		echo "a setting is missing or outside its allowed range"
		return 1
	fi
	domain=$(jq -r '.bounceSenderDomain' "$file")
	if [ -n "$domain" ] && [ "$(postmap -q "$domain" "$DOMAINS_MAP" 2>/dev/null)" != "1" ]; then
		echo "$domain is not an active domain hosted on this server"
		return 1
	fi
}

backup() {
	rm -rf "$BACKUP_DIR"
	mkdir -p "$BACKUP_DIR"
	cp -p "$CONF_DIR/main.cf" "$BACKUP_DIR/main.cf"
	[ ! -f "$BOUNCE_FILE" ] || cp -p "$BOUNCE_FILE" "$BACKUP_DIR/bounce.cf"
}

restore() {
	cp -p "$BACKUP_DIR/main.cf" "$CONF_DIR/main.cf"
	if [ -f "$BACKUP_DIR/bounce.cf" ]; then
		cp -p "$BACKUP_DIR/bounce.cf" "$BOUNCE_FILE"
	else
		rm -f "$BOUNCE_FILE"
	fi
}

configure() {
	local file="$1" local_part domain delay lifetime sender
	IFS='|' read -r local_part domain delay lifetime < <(
		jq -r '[.bounceSenderLocal, .bounceSenderDomain, .delayWarningHours, .maximalQueueLifetimeDays] | map(tostring) | join("|")' "$file"
	)
	sender="mailer-daemon"
	[ -z "$domain" ] || sender="${local_part}@${domain}"
	sed "s/__SENDER__/${sender}/g" "$TEMPLATE_DIR/bounce.cf" >"$BOUNCE_FILE.tmp" || return 1
	mv "$BOUNCE_FILE.tmp" "$BOUNCE_FILE"
	postconf -e "bounce_template_file = $BOUNCE_FILE" || return 1
	postconf -e "delay_warning_time = ${delay}h" "maximal_queue_lifetime = ${lifetime}d"
}

apply() {
	local running="$1" file version error output applied applied_at
	file="$SETTINGS_FILE"
	if [ ! -f "$file" ]; then
		file=$(mktemp)
		echo "$DEFAULTS" >"$file"
	fi
	version=$(jq -r '.version // 0' "$file" 2>/dev/null)
	[[ "$version" =~ ^[0-9]+$ ]] || version=0
	if [ "$running" = "yes" ]; then
		applied=$(previous .appliedVersion)
		applied_at=$(previous .appliedAt)
	fi
	[[ "${applied:-}" =~ ^[0-9]+$ ]] || applied=0

	if ! error=$(validate "$file"); then
		log "settings version $version refused: $error"
		write_status "$version" "$applied" "${applied_at:-}" "$error"
		[ "$file" = "$SETTINGS_FILE" ] || rm -f "$file"
		return 1
	fi

	backup
	if ! configure "$file" || ! output=$({ postfix check && postconf -b >/dev/null; } 2>&1); then
		restore
		error="${output:-postconf could not write the settings}"
		log "settings version $version rolled back: $error"
		write_status "$version" "$applied" "${applied_at:-}" "$error"
		[ "$file" = "$SETTINGS_FILE" ] || rm -f "$file"
		return 1
	fi
	[ "$file" = "$SETTINGS_FILE" ] || rm -f "$file"

	if [ "$running" = "yes" ] && postfix status >/dev/null 2>&1; then
		if ! output=$(postfix reload 2>&1); then
			restore
			postfix reload >/dev/null 2>&1
			log "settings version $version rolled back, reload failed: $output"
			write_status "$version" "$applied" "${applied_at:-}" "$output"
			return 1
		fi
	fi
	log "settings version $version applied"
	write_status "$version" "$version" "$(now)" ""
}

checksum() { sha256sum "$SETTINGS_FILE" 2>/dev/null | cut -d' ' -f1; }

if [ "${1:-}" = "apply" ]; then
	apply no
	exit 0
fi

mkdir -p "$SETTINGS_DIR"
last=$(checksum)
log "watching $SETTINGS_FILE"
while :; do
	inotifywait -q -t 60 -e close_write,moved_to,delete "$SETTINGS_DIR" >/dev/null 2>&1
	sleep 1
	current=$(checksum)
	if [ "$current" != "$last" ]; then
		apply yes
		last="$current"
	fi
done
