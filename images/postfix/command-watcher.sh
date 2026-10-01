#!/usr/bin/env bash
set -uo pipefail

COMMAND_DIR=/var/lib/postfix-managed/commands
SPOOL_DIR=/var/spool/postfix
TAG="command-watcher[postfix]"
RESULT_TTL_MINUTES=10

log() { printf "%s %s\n" "$TAG" "$*"; }

respond() {
	local id="$1" status="$2" message="$3"
	jq -n --arg status "$status" --arg message "$message" '{status: $status, message: $message}' \
		>"$COMMAND_DIR/.$id.res.tmp" && chmod 0644 "$COMMAND_DIR/.$id.res.tmp" && mv "$COMMAND_DIR/.$id.res.tmp" "$COMMAND_DIR/$id.res.json"
}

handle() {
	local file="$1" id action queue queue_id output
	id=$(basename "$file" .req.json)
	[[ "$id" =~ ^[0-9a-f-]{36}$ ]] || {
		rm -f "$file"
		return
	}
	if ! jq -e 'type == "object" and (keys == ["action","queue","queueId"])' "$file" >/dev/null 2>&1; then
		rm -f "$file"
		respond "$id" "invalid" "the command is not an object with action, queue and queueId only"
		return
	fi
	IFS='|' read -r action queue queue_id < <(jq -r '[.action, .queue, .queueId] | map(tostring) | join("|")' "$file")
	rm -f "$file"
	if [[ ! "$queue" =~ ^(active|deferred|hold|incoming)$ ]] || [[ ! "$queue_id" =~ ^[0-9A-Za-z]{6,32}$ ]]; then
		respond "$id" "invalid" "unknown queue or queue id"
		return
	fi
	case "$action" in
	delete) delete_message "$id" "$queue" "$queue_id" ;;
	retry) retry_message "$id" "$queue" "$queue_id" ;;
	*) respond "$id" "invalid" "unknown action" ;;
	esac
}

delete_message() {
	local id="$1" queue="$2" queue_id="$3" output
	output=$(postsuper -d "$queue_id" "$queue" 2>&1)
	if printf "%s" "$output" | grep -q "Deleted: 1 message"; then
		log "deleted $queue_id from $queue"
		respond "$id" "deleted" "$queue_id deleted from $queue"
	else
		respond "$id" "not-found" "$queue_id is not in the $queue queue"
	fi
}

retry_message() {
	local id="$1" queue="$2" queue_id="$3" output
	if [[ ! "$queue" =~ ^(deferred|hold)$ ]]; then
		respond "$id" "invalid" "the $queue queue cannot be retried"
		return
	fi
	if [ -z "$(find "$SPOOL_DIR/$queue" -type f -name "$queue_id" -print -quit 2>/dev/null)" ]; then
		respond "$id" "not-found" "$queue_id is not in the $queue queue"
		return
	fi
	if [ "$queue" = "hold" ]; then
		output=$(postsuper -H "$queue_id" hold 2>&1)
		if ! printf "%s" "$output" | grep -q "Released from hold: 1 message"; then
			respond "$id" "not-found" "$queue_id is not in the hold queue"
			return
		fi
	fi
	if ! output=$(postqueue -i "$queue_id" 2>&1); then
		respond "$id" "invalid" "postqueue refused $queue_id: $output"
		return
	fi
	log "retried $queue_id from $queue"
	respond "$id" "retried" "$queue_id scheduled for delivery"
}

sweep() {
	local file
	for file in "$COMMAND_DIR"/*.req.json; do
		[ -f "$file" ] && handle "$file"
	done
	find "$COMMAND_DIR" -maxdepth 1 -name "*.res.json" -mmin +"$RESULT_TTL_MINUTES" -delete 2>/dev/null
}

mkdir -p "$COMMAND_DIR"
log "watching $COMMAND_DIR"
while :; do
	sweep
	inotifywait -m -q -e close_write,moved_to --format "%f" "$COMMAND_DIR" 2>/dev/null | while read -r name; do
		case "$name" in
		*.req.json) sweep ;;
		esac
	done
	sleep 1
done
