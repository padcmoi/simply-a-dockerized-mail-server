# Antivirus (ClamAV)

The single source of `reject` decisions in the entire mail stack.

## Why reject and not "tag as spam"?

[delivery/](../delivery/README.md) lays out the principle:

> Never reject a non-virus mail. `reject` is reserved for ClamAV.

Spam, blocklisted senders, SPF / DMARC failures, low bayes scores --
all of them result in `add_header` (= `X-Spam-Flag: YES` -> Junk). A
virus is the only case where storing the message is more dangerous than
losing it, so we say 5xx at SMTP time and let the sender deal with the
NDR.

## How it is wired

```
+------------+ TCP 3310  +----------+
| mail-clamav|<----------| mail-rspamd|
|  (clamd)   |           |  antivirus |
+------------+           |  module    |
                         +----+-------+
                              |
                              | milter MILTER_RESP=reject
                              v
+-----------------+   554 5.7.1   +----------------+
| postfix smtpd   |-------------> | external client|
| port 25         |    NDR        +----------------+
+-----------------+
```

Rspamd's antivirus module config in
[`images/rspamd/conf/local.d/antivirus.conf`](../../images/rspamd/conf/local.d/antivirus.conf):

```
clamav {
  symbol = "CLAM_VIRUS";
  type = "clamav";
  log_clean = true;
  servers = "mail-clamav:3310";
  scan_mime_parts = true;
  scan_text_mime = false;     # see below
  scan_image_mime = false;
  max_size = 31457280;        # 30 MiB
  action = "reject";
  message = '${SCANNER}: virus found: "${VIRUS}"';
}
```

The compose file declares clamav as a **healthcheck dependency** of
rspamd:

```
rspamd:
  depends_on:
    redis:    { condition: service_healthy }
    clamav:   { condition: service_healthy }
```

so rspamd never starts in a state where it would silently let viruses
through because clamd is not answering.

## scan_text_mime = false: what to send for an EICAR test

Rspamd skips `text/plain` MIME parts to save CPU; ClamAV would catch a
text EICAR string but rspamd would not call it. To test the chain,
send EICAR as a **binary attachment** (`application/octet-stream`).

The test [tests/08-antivirus.sh](../../tests/08-antivirus.sh) does
exactly this: builds a `multipart/mixed` mail with a base64-encoded
EICAR payload, hands it to postfix on port 25 (no AUTH so the milter
chain runs), and asserts the SMTP exchange ends with a 5xx mentioning
`virus`/`infected`/`clam`.

```python
EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
# Wrap as multipart/mixed with octet-stream attachment
# Send to postfix:25, expect SMTPDataError(554, ..., 'virus found: "Eicar-Test-Signature"')
```

## clamd freshness

The base image
[`images/clamav/Dockerfile`](../../images/clamav/Dockerfile) sets up
`freshclam` so signatures update automatically. The healthcheck
(`echo PING | nc -w 2 127.0.0.1 3310 | grep -q PONG`) does **not**
verify signature age; if you suspect stale signatures:

```
docker exec mail-clamav freshclam --foreground
docker exec mail-clamav clamdscan --version
```

## Common questions

- **Q: Can I let viruses land in Junk instead of rejecting them?**
  Set `action = "add_header"` in `antivirus.conf` and rebuild rspamd.
  The spam-to-junk sieve will route them to Junk. Not recommended.
- **Q: Where do rejected viruses go?**
  Nowhere -- postfix returns 5xx, the message never enters the queue.
  The sender (or their MTA) gets an NDR.
- **Q: What is the max size that gets scanned?**
  30 MiB (`max_size = 31457280`). Above that, ClamAV is bypassed and
  the mail is delivered untouched. Tune the limit alongside
  `ATTACHMENT_MAX_SIZE_MB` in `.env` if you raise the attachment cap.

## How to debug

- `docker exec mail-rspamd rspamc -h 127.0.0.1:11334 < /path/to/eml` --
  manual scan, the response shows every fired symbol including
  `CLAM_VIRUS`.
- `docker exec mail-clamav cat /var/log/clamav/clamd.log` -- clamd
  itself. Also `clamdtop` for a live view.
- `docker logs mail-rspamd 2>&1 | grep -i clam` -- antivirus module log
  lines (timeouts, missing signatures, etc.).
