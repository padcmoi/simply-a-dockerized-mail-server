#!/bin/sh
# Upsert a fileinto rule in the user's active managesieve script.
#
# Args:
#   $1 = recipient email (lower-cased)
#   $2 = sender address  (lower-cased)
#   $3 = destination folder (a user-created folder)
#
# Layout: dovecot's per-user sieve dir is ~/sieve and the active script is
# pointed to by ~/.dovecot.sieve. With sieve = file:~/sieve;active=~/.dovecot
# .sieve and our virtual home /var/mail/vhosts/<domain>/<local>/ this gives:
#   /var/mail/vhosts/<domain>/<local>/sieve/<name>.sieve
#   /var/mail/vhosts/<domain>/<local>/.dovecot.sieve -> sieve/<name>.sieve
#
# Each auto-generated rule follows Roundcube's exact managesieve format so
# the entry shows up natively in Roundcube > Settings > Filters and can be
# edited/deleted by the user from the UI. The expected shape is:
#   # rule:[AUTOROUTER <folder> <sender>]
#   if allof (address :is "From" "<sender>")
#   {
#   <tab>fileinto "<folder>";
#   <tab>stop;
#   }
# CRLF line endings, single-condition `allof` (Roundcube generates the same
# wrapper for one test), `{` on its own line, tab-indented body. The marker
# name lists the destination folder before the sender so the Filtres list
# reads as "in DF, mail from padcmoi" at a glance. Lookup happens on the
# `AUTOROUTER ` prefix AND the trailing ` <sender>]` suffix so a folder
# change for the same sender rewrites the marker and the body in place;
# we keep exactly one entry per sender, never two.

set -eu

USER="${1:?recipient required}"
FROM="${2:?sender required}"
DEST="${3:?destination required}"

DOMAIN="${USER#*@}"
LOCAL="${USER%@*}"
HOME_DIR="/var/mail/vhosts/${DOMAIN}/${LOCAL}"
SIEVE_DIR="${HOME_DIR}/sieve"
ACTIVE_LINK="${HOME_DIR}/.dovecot.sieve"
DEFAULT_NAME="roundcube"
DEFAULT_SCRIPT="${SIEVE_DIR}/${DEFAULT_NAME}.sieve"

mkdir -p "$SIEVE_DIR"

# Resolve the active script. Fall back to the roundcube-managed name when
# nothing is active yet so a freshly provisioned user gets a single script
# that Roundcube can see and edit.
ACTIVE_SCRIPT=""
if [ -L "$ACTIVE_LINK" ]; then
  target="$(readlink "$ACTIVE_LINK")"
  case "$target" in
    /*) ACTIVE_SCRIPT="$target" ;;
    *)  ACTIVE_SCRIPT="${HOME_DIR}/${target}" ;;
  esac
fi

if [ -z "$ACTIVE_SCRIPT" ] || [ ! -f "$ACTIVE_SCRIPT" ]; then
  ACTIVE_SCRIPT="$DEFAULT_SCRIPT"
  : > "$ACTIVE_SCRIPT"
  ln -sf "sieve/${DEFAULT_NAME}.sieve" "$ACTIVE_LINK"
fi

# Drop the "/* empty script */" placeholder that Roundcube writes when the
# user has no rules yet: that C-style comment confuses Roundcube's own sieve
# parser as soon as it appears inside an otherwise non-empty script (the
# parser's inner comment loop only handles `#` lines, so a `/*` line breaks
# it out before reaching our rule and the rule never shows up in Filtres).
if grep -q '^/\* empty script \*/' "$ACTIVE_SCRIPT"; then
  TMP_STRIP="$(mktemp)"
  grep -v '^/\* empty script \*/' "$ACTIVE_SCRIPT" > "$TMP_STRIP"
  mv "$TMP_STRIP" "$ACTIVE_SCRIPT"
fi

# Ensure require ["fileinto"]; is present at the top. We never edit existing
# require lines, only prepend our own when nothing useful is there yet.
if ! grep -Eq '^[[:space:]]*require[[:space:]]+\[[^]]*"fileinto"' "$ACTIVE_SCRIPT"; then
  TMP_REQ="$(mktemp)"
  printf 'require ["fileinto"];\n\n' > "$TMP_REQ"
  cat "$ACTIVE_SCRIPT" >> "$TMP_REQ"
  mv "$TMP_REQ" "$ACTIVE_SCRIPT"
fi

MARKER="# rule:[AUTOROUTER ${DEST} ${FROM}]"
PREFIX="# rule:[AUTOROUTER "
SUFFIX=" ${FROM}]"
TMP_NORM="$(mktemp)"
TMP_NEW="$(mktemp)"

# Normalise CRLF -> LF for awk processing; the file is re-written in CRLF at
# the end so Roundcube's parser keeps seeing its native line endings.
tr -d '\r' < "$ACTIVE_SCRIPT" > "$TMP_NORM"

# Drop any existing AUTOROUTER block for this sender, regardless of which
# folder it currently routes to. A block matches when its marker line both
# starts with the AUTOROUTER prefix AND ends with the " <sender>]" suffix.
# This is what lets a "DA -> DF" folder change in the marker stay a single
# entry: the old marker is removed before the fresh one is appended.
awk -v P="$PREFIX" -v S="$SUFFIX" '
  in_block { if ($0 == "}") { in_block = 0 }; next }
  substr($0, 1, length(P)) == P && substr($0, length($0) - length(S) + 1) == S { in_block = 1; next }
  { print }
' "$TMP_NORM" > "$TMP_NEW"

# Strip trailing blank lines, then guarantee a single trailing newline so
# our block starts cleanly on its own line.
sed -i -e :a -e '/^$/{$d;N;ba' -e '}' "$TMP_NEW" 2>/dev/null || true
if [ -s "$TMP_NEW" ] && [ "$(tail -c1 "$TMP_NEW" | od -An -c | tr -d ' ')" != '\n' ]; then
  printf '\n' >> "$TMP_NEW"
fi

# Append the fresh block (still LF; CRLF conversion happens below).
{
  printf '%s\n' "$MARKER"
  printf 'if allof (address :is "From" "%s")\n' "$FROM"
  printf '{\n'
  printf '\tfileinto "%s";\n' "$DEST"
  printf '\tstop;\n'
  printf '}\n'
} >> "$TMP_NEW"

# Re-normalise to CRLF so Roundcube re-reads its own dialect.
sed -i 's/$/\r/' "$TMP_NEW"

mv "$TMP_NEW" "$ACTIVE_SCRIPT"
rm -f "$TMP_NORM"
chown vmail:vmail "$ACTIVE_SCRIPT" 2>/dev/null || true

# Recompile so dovecot picks up the change without waiting for the next
# delivery's lazy compile. Failure is non-fatal: the next delivery will
# recompile anyway.
sievec "$ACTIVE_SCRIPT" >/dev/null 2>&1 || true
chown vmail:vmail "${ACTIVE_SCRIPT%.sieve}.svbin" 2>/dev/null || true

exit 0
