import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { promisify } from "util";

const exec = promisify(execFile);

// Hash a plaintext password with the standard $6$ SHA-512 crypt format using
// openssl. Matches the legacy passwords stored in VirtualUsers.password and
// dovecot's SHA512-CRYPT scheme.
export async function sha512crypt(plain: string): Promise<string> {
  const salt = randomBytes(8)
    .toString("base64")
    .replace(/[^a-zA-Z0-9./]/g, "")
    .slice(0, 16);
  const { stdout } = await exec("openssl", ["passwd", "-6", "-salt", salt, plain]);
  return stdout.trim();
}
