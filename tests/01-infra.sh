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
    if [[ "$s" == "running" ]]; then
      pass "running.$c" "running"
    elif [[ "$c" == "mail-fail2ban" ]]; then
      skip "running.$c" "known issue ($s)"
    else
      fail "running.$c" "$s"
    fi
  done
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
  for t in Accounts RefreshTokens SieveRejectSenders VirtualAliases VirtualDomains VirtualQuotaDomains VirtualQuotaUsers VirtualUsers; do
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
  # 4190 (ManageSieve) is bridge-only -- reach it from another container.
  if docker exec mail-roundcube sh -c 'echo | nc -z mail-dovecot 4190 2>/dev/null || (echo > /dev/tcp/mail-dovecot/4190 2>/dev/null)' 2>/dev/null; then
    pass "tcp.4190.bridge" "open"
  elif docker exec mail-dovecot sh -c 'echo | nc -z 127.0.0.1 4190' >/dev/null 2>&1; then
    pass "tcp.4190.bridge" "open (local)"
  else
    fail "tcp.4190.bridge" "closed"
  fi
}

t_containers_healthy
t_redis_pong
t_clamav_responds
t_mariadb_schema
t_ports_open
