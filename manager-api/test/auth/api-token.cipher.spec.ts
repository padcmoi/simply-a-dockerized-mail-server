import { describe, it, expect } from "vitest";
import { decryptSecret, encryptSecret } from "../../src/core/auth/api-token/api-token.cipher";

const PEPPER = "test-pepper";
const SECRET = "c29tZS1yYW5kb20tc2VjcmV0LXZhbHVl";

describe("api-token cipher", () => {
  it("gives back what it sealed", () => {
    expect(decryptSecret(encryptSecret(SECRET, PEPPER), PEPPER)).toBe(SECRET);
  });

  it("seals the same secret differently every time", () => {
    expect(encryptSecret(SECRET, PEPPER)).not.toBe(encryptSecret(SECRET, PEPPER));
  });

  it("writes a versioned four field payload", () => {
    const [version, iv, tag, encrypted] = encryptSecret(SECRET, PEPPER).split("$");
    expect(version).toBe("v1");
    expect(Buffer.from(iv ?? "", "base64url")).toHaveLength(12);
    expect(Buffer.from(tag ?? "", "base64url")).toHaveLength(16);
    expect(encrypted).toBeTruthy();
  });

  it("refuses to open what another pepper sealed", () => {
    expect(decryptSecret(encryptSecret(SECRET, PEPPER), "rotated-pepper")).toBeNull();
  });

  it("refuses a payload edited in the database", () => {
    const [version, iv, tag, encrypted] = encryptSecret(SECRET, PEPPER).split("$");
    const tampered = Buffer.from(encrypted ?? "", "base64url");
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(decryptSecret([version, iv, tag, tampered.toString("base64url")].join("$"), PEPPER)).toBeNull();
  });

  it("refuses a payload of another shape", () => {
    expect(decryptSecret("", PEPPER)).toBeNull();
    expect(decryptSecret("v2$a$b$c", PEPPER)).toBeNull();
    expect(decryptSecret("v1$only-one-field", PEPPER)).toBeNull();
  });
});
