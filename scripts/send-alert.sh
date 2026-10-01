#!/usr/bin/env bash
# Usage:
#   scripts/send-alert.sh "<subject>" "<message>"   mail the alert address set in the manager
#   scripts/send-alert.sh --check                   prove the route only answers this machine
set -uo pipefail

cd "$(dirname "$0")/.."

API_CONTAINER=mail-manager-api
UI_CONTAINER=mail-manager-ui
ROUTE=/api/v1/internal/alert

POST_JS='
const [url, subject, message] = process.argv.slice(1);
fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ subject, message }),
})
  .then(async (res) => console.log(res.status + " " + (await res.text()).slice(0, 300)))
  .catch((err) => console.log("000 " + err.message));
'

post_from() {
	local container="$1" url="$2" subject="$3" message="$4"
	docker exec "$container" node -e "$POST_JS" "$url" "$subject" "$message" 2>&1
}

env_value() {
	grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-
}

expect() {
	local label="$1" wanted="$2" answer="$3"
	if [ "${answer%% *}" = "$wanted" ]; then
		printf "PASS  %-58s %s\n" "$label" "${answer%% *}"
	else
		printf "FAIL  %-58s wanted %s, got: %s\n" "$label" "$wanted" "$answer"
		FAILED=1
	fi
}

check() {
	FAILED=0
	local port ip api_port answer
	api_port=$(docker exec "$API_CONTAINER" sh -c 'echo "${MANAGER_API_PORT:-3000}"')
	port=$(env_value BINDING_PORT_MANAGEUI)
	ip=$(env_value BINDING_IP_MANAGEUI)
	[ "$ip" = "0.0.0.0" ] && ip=127.0.0.1

	answer=$(docker exec "$API_CONTAINER" node -e "$POST_JS" "http://127.0.0.1:$api_port$ROUTE" "" "")
	expect "from this machine, empty body (reached, nothing sent)" 400 "$answer"

	answer=$(post_from "$UI_CONTAINER" "http://$API_CONTAINER:$api_port$ROUTE" "check" "check")
	expect "from another container" 403 "$answer"

	if [ -n "$port" ]; then
		answer=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" \
			-d '{"subject":"check","message":"check"}' "http://${ip:-127.0.0.1}:$port$ROUTE" 2>/dev/null)
		expect "through the interface, the way in from the internet" 403 "$answer"
	fi

	answer=$(docker exec "$API_CONTAINER" node -e '
fetch(process.argv[1], {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
  body: JSON.stringify({ subject: "check", message: "check" }),
}).then((res) => console.log(res.status)).catch((err) => console.log("000 " + err.message));
' "http://127.0.0.1:$api_port$ROUTE")
	expect "from this machine but relayed by a proxy" 403 "$answer"

	[ "$FAILED" = 0 ] && echo "The route only answers this machine." || echo "The route is NOT closed as expected."
	return "$FAILED"
}

if ! docker inspect -f '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null | grep -q true; then
	echo "$API_CONTAINER is not running" >&2
	exit 2
fi

if [ "${1:-}" = "--check" ]; then
	check
	exit $?
fi

if [ "$#" -ne 2 ] || [ -z "$1" ] || [ -z "$2" ]; then
	sed -n '2,4p' "$0" | sed 's/^# \{0,1\}//' >&2
	exit 2
fi

API_PORT=$(docker exec "$API_CONTAINER" sh -c 'echo "${MANAGER_API_PORT:-3000}"')
ANSWER=$(post_from "$API_CONTAINER" "http://127.0.0.1:$API_PORT$ROUTE" "$1" "$2")
case "${ANSWER%% *}" in
204) echo "Alert sent." ;;
409) echo "No alert address is set in the manager (/admin/config/alert): nothing sent." >&2 && exit 3 ;;
429) echo "An alert was sent to this address moments ago: this one was dropped." >&2 && exit 4 ;;
503) echo "Outbound mail is not configured in the manager: nothing sent." >&2 && exit 5 ;;
*) echo "Alert not sent: $ANSWER" >&2 && exit 1 ;;
esac
