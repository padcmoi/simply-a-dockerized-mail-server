import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function derive(plain: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, keylen, opts, (err, dk) => (err ? reject(err) : resolve(dk)));
  });
}

export async function scryptHash(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await derive(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export async function scryptVerify(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length === 0) return false;
  const dk = await derive(plain, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}
