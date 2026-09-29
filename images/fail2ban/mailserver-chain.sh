#!/bin/sh
set -eu

CHAIN="f2b-mailserver"
SUBNET="172.200.0.0/24"
PORTS="25,465,587,993"
LOCK="/var/run/fail2ban/mailserver-chain.lock"
JUMP="-d ${SUBNET} -p tcp -m multiport --dports ${PORTS} -j ${CHAIN}"

ipt() { iptables -w "$@"; }

usage() {
	echo "usage: $0 start|stop|check <jail> | ban|unban <jail> <ip>" >&2
	exit 2
}

[ $# -ge 2 ] || usage
action="$1"
jail="$2"
case "$jail" in
*[!A-Za-z0-9_-]* | "") usage ;;
esac
sub="f2b-mail-${jail}"
if [ "${#sub}" -gt 28 ]; then
	echo "$0: chain $sub is longer than the 28 characters iptables allows, rename the jail" >&2
	exit 1
fi

start() {
	ipt -N "$CHAIN" 2>/dev/null || true
	ipt -N DOCKER-USER 2>/dev/null || true
	ipt -C DOCKER-USER $JUMP 2>/dev/null || ipt -I DOCKER-USER 1 $JUMP
	ipt -N "$sub" 2>/dev/null || true
	ipt -F "$sub"
	ipt -A "$sub" -j RETURN
	ipt -C "$CHAIN" -j "$sub" 2>/dev/null || ipt -A "$CHAIN" -j "$sub"
}

stop() {
	while ipt -D "$CHAIN" -j "$sub" 2>/dev/null; do :; done
	ipt -F "$sub" 2>/dev/null || true
	ipt -X "$sub" 2>/dev/null || true
	if ! ipt -S "$CHAIN" 2>/dev/null | grep -q -- "^-A ${CHAIN} "; then
		while ipt -D DOCKER-USER $JUMP 2>/dev/null; do :; done
		ipt -X "$CHAIN" 2>/dev/null || true
	fi
}

ipv4() {
	case "$1" in
	*:*) return 1 ;;
	*[!0-9.]* | "") return 1 ;;
	esac
	return 0
}

mkdir -p "$(dirname "$LOCK")"
exec 9>"$LOCK"
flock 9

case "$action" in
start) start ;;
stop) stop ;;
check)
	ipt -C DOCKER-USER $JUMP && ipt -C "$CHAIN" -j "$sub"
	;;
ban)
	[ $# -eq 3 ] || usage
	ipv4 "$3" || exit 0
	ipt -C "$sub" -s "$3" -j REJECT --reject-with icmp-port-unreachable 2>/dev/null ||
		ipt -I "$sub" 1 -s "$3" -j REJECT --reject-with icmp-port-unreachable
	;;
unban)
	[ $# -eq 3 ] || usage
	ipv4 "$3" || exit 0
	while ipt -D "$sub" -s "$3" -j REJECT --reject-with icmp-port-unreachable 2>/dev/null; do :; done
	;;
*) usage ;;
esac
