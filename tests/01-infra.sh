#!/usr/bin/env bash
# Infrastructure: container state, healthchecks, mariadb schema + triggers,
# host-exposed and bridge-only network ports.

t_containers_healthy() {
  section "Infrastructure"
  for c in "${HEALTH_CONTAINERS[@]}"; do
    local s; s=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo missing)
    [[ "$s" == "healthy" ]] && pass "health.$c" "healthy" || fail "health.$c" "$s"
  done
  for c in "${STACK_CONTAINERS[@]}"; do
    local s; s=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
    [[ "$s" == "running" ]] && pass "running.$c" "running" || fail "running.$c" "$s"
  done
}

# The icon, the logo and the favicon a company can replace live at the root of
# the volumes folder. manager-api puts a copy of its own marks there when it
# starts, where one is missing, through its mount of that folder: the three
# files have to be in place, and the public route that tells the interface
# about them has to answer.
t_branding_files() {
  local name out
  for name in custom-mail-icon.svg custom-mail-logo.svg custom-mail-favicon.svg; do
    if docker exec mail-manager-api test -f "/host/volumes/$name"; then
      pass "branding.file.$name" "in the volumes folder, seen by manager-api"
    else
      fail "branding.file.$name" "missing from the volumes folder, or not seen by manager-api"
    fi
  done
  out=$(docker exec mail-manager-api node -e 'fetch("http://127.0.0.1:" + (process.env.MANAGER_API_PORT || 3000) + "/api/v1/branding").then(async (r) => console.log(r.status, await r.text())).catch((e) => console.log("failed", e.message))' 2>&1)
  if grep -q '^200 .*"custom":.*"favicon":' <<<"$out"; then
    pass "branding.route_answers" "$out"
  else
    fail "branding.route_answers" "$out"
  fi
}

t_redis_pong() {
  local r; r=$(redis_get PING)
  assert_eq "redis.ping" "PONG" "$r"
}

t_clamav_responds() {
  local r; r=$(docker exec mail-clamav sh -c 'echo PING | nc -w 2 127.0.0.1 3310' 2>/dev/null | tr -d '\0\n')
  assert_eq "clamav.ping" "PONG" "$r"
}

t_mariadb_schema() {
  local tables
  tables=$(docker exec mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" -BN mailserver -e "SHOW TABLES" 2>/dev/null | sort | tr '\n' ' ')
  for t in accounts dkim_keys refresh_tokens sieve_reject_senders virtual_aliases virtual_domains virtual_quota_domains virtual_quota_users virtual_users; do
    case " $tables " in
      *" $t "*) pass "db.table.$t" "present" ;;
      *)        fail "db.table.$t" "missing (have: $tables)" ;;
    esac
  done
  local trig_count
  trig_count=$(docker exec mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" -BN mailserver -e "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'mailserver'" 2>/dev/null)
  [[ "${trig_count:-0}" -ge 5 ]] && pass "db.quota_triggers" "count=$trig_count" || fail "db.quota_triggers" "count=$trig_count (expected >=5)"
}

t_ports_open() {
  section "Network surface"
  for port in 25 465 587 993; do
    if timeout 3 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" 2>/dev/null; then
      pass "tcp.$port" "open"
    else
      fail "tcp.$port" "closed"
    fi
  done
  # 4190 (ManageSieve) is bridge-only. Probe it from inside dovecot, which
  # is always present; the previous bridge-via-roundcube probe broke when
  # the webmail overlay is not deployed.
  if docker exec mail-dovecot sh -c 'echo | nc -z 127.0.0.1 4190' >/dev/null 2>&1; then
    pass "tcp.4190.bridge" "open (local)"
  else
    fail "tcp.4190.bridge" "closed"
  fi
}

# The resolver postfix, rspamd, opendmarc and manager-api ask validates DNSSEC.
# With a root key that is out of date it answers SERVFAIL to every name while
# its container still reports healthy, so its answers are checked here: a plain
# name resolves through the running resolver, and a signed one comes back
# validated with the trust anchor it is configured with.
t_resolver_answers() {
  local out
  out=$(docker exec mail-unbound nslookup www.googleapis.com 127.0.0.1 2>&1)
  if grep -q "Name:" <<<"$out" && ! grep -q "can't find" <<<"$out"; then
    pass "resolver.answers" "www.googleapis.com resolves"
  else
    fail "resolver.answers" "$(grep -E "can't find|SERVFAIL" <<<"$out" | tail -1)"
  fi
  out=$(docker exec mail-unbound unbound-host -C /etc/unbound/unbound.conf -v -t A iana.org 2>&1)
  if grep -q "(secure)" <<<"$out"; then
    pass "resolver.validates_a_signed_name" "iana.org is secure"
  else
    fail "resolver.validates_a_signed_name" "$(tail -1 <<<"$out")"
  fi
}

t_containers_healthy
t_resolver_answers
t_branding_files
t_redis_pong
t_clamav_responds
t_mariadb_schema
t_ports_open
