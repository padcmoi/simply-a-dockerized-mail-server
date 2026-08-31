-- USER_BLOCKLIST  -- per-recipient sender blocklist
-- GLOBAL_BLOCKLIST -- cross-user reputation (>= 75% of recipients flagged
--                    this sender as spam over the sample window)
--
-- Both rules are driven by the counters maintained by
-- images/dovecot/conf/sieve/bin/sa-learn-pipe.sh and the post-filter
-- defined at the bottom of this file:
--
--   spam_count:<rcpt>:<from>          INCR on spam-flag, DEL on ham-flag
--   senders:<from>:reporters  (SET)   SADD on spam-flag, SREM on ham-flag
--   senders:<from>:recipients (SET)   SADD on every delivered inbound mail
--
-- The per-recipient counter triggers USER_BLOCKLIST as soon as that single
-- recipient has marked the sender as spam THRESHOLD (=3) times.
-- The two sets together let us compute a Gmail-style consensus: when at
-- least MIN_RECIPIENTS distinct users have received mail from <from>, and
-- at least RATIO_THRESHOLD of them have explicitly flagged it as spam, the
-- sender is treated as a real spammer and rejected for everyone.

local rspamd_logger = require "rspamd_logger"
local lua_redis = require "lua_redis"

local N = "blocklist"
local USER_THRESHOLD = 3
local GLOBAL_MIN_RECIPIENTS = 4
local GLOBAL_RATIO = 0.75

local redis_params = lua_redis.parse_redis_server(N)
if not redis_params then
  rspamd_logger.warnx(rspamd_config, "rspamd.local.lua: no redis configured, rules disabled")
  return
end

local function normalize(addr)
  if not addr then return nil end
  return string.lower(addr)
end

-- Parse the raw From: header ourselves instead of using task:get_from(),
-- because rspamd's address parser normalises well-known providers (Gmail
-- strips dots and +tags in the local part, etc.) -- which makes the
-- blocklist miss when the user flags "julien.jean.06100@gmail.com" and
-- the next inbound mail arrives via the same address read as
-- "julienjean06100@gmail.com" by rspamd. The shell side (sa-learn-pipe.sh)
-- already extracts the address as it literally appears in the header, so
-- doing the same here keeps both ends keyed on identical strings.
local function extract_addr_from_header(raw)
  if not raw or raw == "" then return nil end
  -- Prefer the bracketed form: "Display Name" <user@domain>
  local addr = raw:match("<([^>]+)>")
  if not addr then
    addr = raw:gsub("[%s\r\n]", "")
  end
  if not addr or addr == "" then return nil end
  addr = normalize(addr)
  if addr == "" then return nil end
  return addr
end

local function get_from_addr(task)
  local raw_from = task:get_header("From")
  local addr = extract_addr_from_header(raw_from)
  if addr then return addr end
  -- Fallback for messages with no From: header (rare): use SMTP envelope.
  local from_smtp = task:get_from("smtp")
  if from_smtp and from_smtp[1] and from_smtp[1].addr and from_smtp[1].addr ~= "" then
    return normalize(from_smtp[1].addr)
  end
  return nil
end

local function get_rcpt_addrs(task)
  -- Recipients use the SMTP envelope, which is the actual delivery address
  -- (mime To: header can be fully forged, e.g. mailing lists with hidden
  -- bcc-style recipients).
  local rcpts = task:get_recipients("smtp")
  local out = {}
  if not rcpts then return out end
  for _, r in ipairs(rcpts) do
    local addr = normalize(r.addr)
    if addr and addr ~= "" then table.insert(out, addr) end
  end
  return out
end

----------------------------------------------------------------------------
-- USER_BLOCKLIST  -- callback runs the check AND inserts the symbol itself
----------------------------------------------------------------------------
local function check_user_blocklist(task)
  local from_addr = get_from_addr(task)
  if not from_addr then return end
  local rcpts = get_rcpt_addrs(task)
  if #rcpts == 0 then return end

  for _, rcpt_addr in ipairs(rcpts) do
    local key = "spam_count:" .. rcpt_addr .. ":" .. from_addr
    local function cb(err, data)
      if err then
        rspamd_logger.errx(task, "user_blocklist GET %s: %s", key, err)
        return
      end
      local n = tonumber(data)
      if n and n >= USER_THRESHOLD then
        task:insert_result("USER_BLOCKLIST", 1.0,
          string.format("rcpt=%s from=%s count=%d", rcpt_addr, from_addr, n))
        -- Force the "add header" action so milter stamps X-Spam-Flag: YES
        -- which the global sieve routes to Junk. Never reject: the user
        -- must keep the option to fish out a useful message from Junk.
        task:set_pre_result("add header",
          string.format("per-recipient blocklist (count=%d)", n),
          "blocklist")
      end
    end
    lua_redis.redis_make_request(task, redis_params, key, false,
      cb, "GET", { key })
  end
end

rspamd_config:register_symbol{
  name = "USER_BLOCKLIST",
  callback = check_user_blocklist,
  score = 15.0,
  description = "Recipient has marked this sender as spam >= "
    .. tostring(USER_THRESHOLD) .. " times",
  group = "policies",
}

----------------------------------------------------------------------------
-- GLOBAL_BLOCKLIST  -- same plain-callback pattern
----------------------------------------------------------------------------
local function check_global_blocklist(task)
  local from_addr = get_from_addr(task)
  if not from_addr then return end

  local k_reporters  = "senders:" .. from_addr .. ":reporters"
  local k_recipients = "senders:" .. from_addr .. ":recipients"

  local function cb_recipients(err, n_recipients_raw)
    if err then
      rspamd_logger.errx(task, "global_blocklist SCARD %s: %s", k_recipients, err)
      return
    end
    local n_recipients = tonumber(n_recipients_raw) or 0
    if n_recipients < GLOBAL_MIN_RECIPIENTS then return end

    local function cb_reporters(err2, n_reporters_raw)
      if err2 then
        rspamd_logger.errx(task, "global_blocklist SCARD %s: %s", k_reporters, err2)
        return
      end
      local n_reporters = tonumber(n_reporters_raw) or 0
      local ratio = n_reporters / n_recipients
      if ratio >= GLOBAL_RATIO then
        task:insert_result("GLOBAL_BLOCKLIST", 1.0,
          string.format("from=%s reporters=%d/%d ratio=%.2f",
            from_addr, n_reporters, n_recipients, ratio))
        -- Same Junk-routing policy as USER_BLOCKLIST: a cross-user
        -- consensus only flags the mail, it never refuses delivery.
        task:set_pre_result("add header",
          string.format("cross-user blocklist (%d/%d)", n_reporters, n_recipients),
          "blocklist")
      end
    end
    lua_redis.redis_make_request(task, redis_params, k_reporters, false,
      cb_reporters, "SCARD", { k_reporters })
  end

  lua_redis.redis_make_request(task, redis_params, k_recipients, false,
    cb_recipients, "SCARD", { k_recipients })
end

rspamd_config:register_symbol{
  name = "GLOBAL_BLOCKLIST",
  callback = check_global_blocklist,
  score = 15.0,
  description = "Cross-user consensus: >= "
    .. tostring(math.floor(GLOBAL_RATIO * 100))
    .. "% of recipients have marked this sender as spam",
  group = "policies",
}

----------------------------------------------------------------------------
-- RECIPIENT_RECORDER -- post-filter that records (from, recipient) pairs
-- in Redis. The denominator of GLOBAL_BLOCKLIST grows naturally with
-- delivered traffic. Idempotent thanks to SADD.
----------------------------------------------------------------------------
local function record_recipients(task)
  local from_addr = get_from_addr(task)
  if not from_addr then return end
  local key = "senders:" .. from_addr .. ":recipients"
  for _, rcpt_addr in ipairs(get_rcpt_addrs(task)) do
    lua_redis.redis_make_request(task, redis_params, key, true,
      function(err)
        if err then
          rspamd_logger.errx(task, "recipient_recorder SADD %s: %s", key, err)
        end
      end,
      "SADD", { key, rcpt_addr })
  end
end

rspamd_config:register_symbol{
  name = "RECIPIENT_RECORDER",
  type = "postfilter",
  callback = record_recipients,
  priority = 10,
}
