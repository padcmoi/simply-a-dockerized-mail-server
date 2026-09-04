import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

// Time-based one-time passwords as every authenticator app computes them
// (RFC 6238 over RFC 4226): HMAC-SHA1 of the 30-second step counter, dynamically
// truncated to six digits. Written on node:crypto rather than pulled in as a
// package: the whole algorithm is a dozen lines, and a dependency that verifies
// the second factor of every sign-in is one more thing to audit and to trust.
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
// One step either side of the current one: a clock a few seconds off, or a code
// typed just as it rolled over, is still accepted.
export const TOTP_WINDOW = 1;
export const TOTP_ISSUER = "Simply Mail Server";

// RFC 4648 base32, the only encoding authenticator apps read a secret in.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// 160 bits, the size RFC 4226 recommends for HMAC-SHA1, as 32 base32 characters.
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpStep(at = Date.now()) {
  return Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
}

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

// The step the code was computed for, or null. The step is what the caller
// remembers to refuse the same code twice: a code seen by someone looking over
// a shoulder is good for the rest of its half-minute otherwise, and the
// standard says to refuse a replay. Only steps after the last accepted one are
// tried, which is what makes the replay impossible rather than merely unlikely.
export function matchTotp(secret: string, code: string, lastUsedStep: number | null, now = Date.now()) {
  const typed = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(typed)) return null;
  const current = totpStep(now);
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step += 1) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (safeEqual(totpCode(secret, step), typed)) return step;
  }
  return null;
}

// What the QR code carries: the label the app shows, the secret, and the
// parameters spelled out even though they are the defaults, so an app that
// reads them strictly and one that ignores them compute the same code.
export function otpauthUri(email: string, secret: string) {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// Recovery codes: what gets someone in when the phone is gone. Ten characters
// from an alphabet with no 0/O or 1/I to misread, shown once as xxxxx-xxxxx and
// kept only as hashes, like a password: a database dump must not be a way in.
// The hash is keyed with the pepper the API already requires, the same one
// that seals the TOTP secret: ten characters of this alphabet are fifty bits,
// which a plain SHA-256 would let a dump be walked through offline in days,
// and the pepper is exactly the piece a dump does not carry.
export const RECOVERY_CODE_COUNT = 8;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 10;

export function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let raw = "";
    for (let i = 0; i < RECOVERY_LENGTH; i += 1) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

// Case, spaces and the dash are presentation: "abcde-fghjk" and "ABCDEFGHJK"
// are the same code.
export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string, pepper: string) {
  return createHmac("sha256", `recovery:${pepper}`).update(normalizeRecoveryCode(code)).digest("hex");
}

// The index of the hash the code matches, or -1: the caller strikes that one
// out, since a recovery code is spent the moment it is used.
export function matchRecoveryCode(code: string, hashes: string[], pepper: string) {
  const typed = normalizeRecoveryCode(code);
  if (typed.length !== RECOVERY_LENGTH) return -1;
  const hashed = hashRecoveryCode(typed, pepper);
  return hashes.findIndex((candidate) => safeEqual(candidate, hashed));
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
