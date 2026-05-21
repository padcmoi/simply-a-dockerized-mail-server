import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SALT_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * SHA512-CRYPT helper - the format Dovecot's `default_pass_scheme = SHA512-CRYPT` expects.
 * Produced hashes look like `$6$<salt>$<hash>`. Identical scheme to 1.x.x prod and `mkpasswd`.
 *
 * Implementation uses `openssl passwd -6` (present in `node:22-alpine`).
 */
@Injectable()
export class Sha512CryptService {
  /** Hash a cleartext password and return the `$6$salt$hash` string. */
  async hash(plaintext: string): Promise<string> {
    if (!plaintext || plaintext.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    const salt = this.generateSalt(16);
    const { stdout } = await execFileAsync('openssl', ['passwd', '-6', '-salt', salt, plaintext]);
    const hashed = stdout.trim();
    if (!hashed.startsWith('$6$')) {
      throw new Error('openssl did not produce a SHA512-CRYPT hash');
    }
    return hashed;
  }

  /** Verify a plaintext against a `$6$salt$hash`. */
  async verify(plaintext: string, stored: string): Promise<boolean> {
    if (!stored.startsWith('$6$')) return false;
    const parts = stored.split('$');
    if (parts.length < 4) return false;
    const salt = parts[2];
    const { stdout } = await execFileAsync('openssl', ['passwd', '-6', '-salt', salt, plaintext]);
    return stdout.trim() === stored;
  }

  private generateSalt(length: number): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += SALT_ALPHABET[bytes[i] % SALT_ALPHABET.length];
    }
    return out;
  }
}
