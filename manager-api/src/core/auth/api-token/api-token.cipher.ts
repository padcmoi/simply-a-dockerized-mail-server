import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const CIPHER = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function cipherKey(pepper: string): Buffer {
  return createHash("sha256").update(`cipher:${pepper}`).digest();
}

export function encryptSecret(secret: string, pepper: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(CIPHER, cipherKey(pepper), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(
    "$"
  );
}

export function decryptSecret(payload: string, pepper: string): string | null {
  const [version, iv, tag, encrypted] = payload.split("$");
  if (version !== VERSION || !iv || !tag || !encrypted) return null;

  try {
    const decipher = createDecipheriv(CIPHER, cipherKey(pepper), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
