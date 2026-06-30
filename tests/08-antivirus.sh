#!/usr/bin/env bash
# ClamAV reject via rspamd antivirus module. EICAR must be sent as a
# binary attachment because rspamd's antivirus.conf has
# `scan_text_mime = false`.

t_clamav_reject() {
  section "ClamAV virus reject"
  local out
  out=$(py - <<PY 2>>"$LOG_FILE"
import smtplib, base64
EICAR = 'X5O!P%@AP[4\\\\PZX54(P^)7CC)7}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!\$H+H*'
boundary = "----eicar-probe-boundary"
attachment = base64.b64encode(EICAR.encode()).decode()
msg = (
  "From: eicar-sender@mail-tester.com\r\n"
  "To: $(email_of at2)\r\n"
  "Subject: eicar-virus-probe\r\n"
  "Date: Sun, 28 Jun 2026 18:00:00 +0000\r\n"
  "MIME-Version: 1.0\r\n"
  f"Content-Type: multipart/mixed; boundary=\"{boundary}\"\r\n\r\n"
  f"--{boundary}\r\nContent-Type: text/plain\r\n\r\nplease scan attachment\r\n"
  f"--{boundary}\r\nContent-Type: application/octet-stream; name=\"eicar.com\"\r\n"
  f"Content-Transfer-Encoding: base64\r\n"
  f"Content-Disposition: attachment; filename=\"eicar.com\"\r\n\r\n"
  f"{attachment}\r\n"
  f"--{boundary}--\r\n"
)
try:
  s = smtplib.SMTP("$TEST_HOST", 25, timeout=20)
  s.sendmail("eicar-sender@mail-tester.com", ["$(email_of at2)"], msg)
  s.quit()
  print("ACCEPTED")
except (smtplib.SMTPDataError, smtplib.SMTPRecipientsRefused, smtplib.SMTPResponseException) as e:
  print("REJECTED", repr(e))
except Exception as e:
  print("ERROR", repr(e))
PY
  )
  if printf '%s' "$out" | grep -q ACCEPTED; then
    fail "clamav.eicar_reject" "EICAR accepted - not blocked"
  elif printf '%s' "$out" | grep -q REJECTED; then
    pass "clamav.eicar_reject" "$(printf '%s' "$out" | head -c 100)"
  else
    fail "clamav.eicar_reject" "unexpected result: $(printf '%s' "$out" | head -c 120)"
  fi
}

t_clamav_reject
