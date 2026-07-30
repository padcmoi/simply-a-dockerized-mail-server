import { describe, it, expect } from "vitest";
import { scryptHash, scryptVerify } from "../../src/core/common/scrypt";

describe("scrypt", () => {
  it("produces a self-describing scrypt$N$r$p$salt$hash string", async () => {
    const h = await scryptHash("s3cret");
    const parts = h.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(16384);
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const h = await scryptHash("s3cret");
    await expect(scryptVerify("s3cret", h)).resolves.toBe(true);
    await expect(scryptVerify("nope", h)).resolves.toBe(false);
  });

  it("uses a random salt so two hashes of the same password differ yet both verify", async () => {
    const a = await scryptHash("same");
    const b = await scryptHash("same");
    expect(a).not.toBe(b);
    await expect(scryptVerify("same", a)).resolves.toBe(true);
    await expect(scryptVerify("same", b)).resolves.toBe(true);
  });

  it("rejects malformed, non-integer-parameter or empty-digest hashes", async () => {
    await expect(scryptVerify("x", "not-a-scrypt-hash")).resolves.toBe(false);
    await expect(scryptVerify("x", "scrypt$16384$8$1$onlyfiveparts")).resolves.toBe(false);
    await expect(scryptVerify("x", "scrypt$abc$8$1$c2FsdA==$aGFzaA==")).resolves.toBe(false);
    await expect(scryptVerify("x", "scrypt$16384$8$1$c2FsdA==$")).resolves.toBe(false);
  });
});
