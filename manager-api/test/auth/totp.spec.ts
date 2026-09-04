import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  RECOVERY_CODE_COUNT,
  TOTP_PERIOD_SECONDS,
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  matchRecoveryCode,
  matchTotp,
  normalizeRecoveryCode,
  otpauthUri,
  totpCode,
  totpStep,
} from "../../src/core/auth/two-factor/totp";

const PEPPER = "pepper-for-tests";

describe("totp", () => {
  describe("base32", () => {
    it("encodes the RFC 4648 vectors", () => {
      expect(base32Encode(Buffer.from(""))).toBe("");
      expect(base32Encode(Buffer.from("f"))).toBe("MY");
      expect(base32Encode(Buffer.from("fo"))).toBe("MZXQ");
      expect(base32Encode(Buffer.from("foo"))).toBe("MZXW6");
      expect(base32Encode(Buffer.from("foob"))).toBe("MZXW6YQ");
      expect(base32Encode(Buffer.from("fooba"))).toBe("MZXW6YTB");
      expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    });

    it("decodes what it encoded, ignoring case, padding and spaces", () => {
      const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 42]);
      const text = base32Encode(bytes);
      expect(base32Decode(text)).toEqual(bytes);
      expect(base32Decode(`${text.toLowerCase()}====`)).toEqual(bytes);
      expect(base32Decode(text.replace(/(.{4})/g, "$1 "))).toEqual(bytes);
    });
  });

  describe("generateTotpSecret", () => {
    it("is 32 base32 characters for 160 bits, different every time", () => {
      const a = generateTotpSecret();
      const b = generateTotpSecret();
      expect(a).toMatch(/^[A-Z2-7]{32}$/);
      expect(base32Decode(a)).toHaveLength(20);
      expect(a).not.toBe(b);
    });
  });

  describe("totpStep", () => {
    it("counts thirty-second steps since the epoch", () => {
      expect(totpStep(0)).toBe(0);
      expect(totpStep(TOTP_PERIOD_SECONDS * 1000 - 1)).toBe(0);
      expect(totpStep(TOTP_PERIOD_SECONDS * 1000)).toBe(1);
      expect(totpStep(59 * 1000)).toBe(1);
      expect(totpStep(1_111_111_109_000)).toBe(37037036);
    });
  });

  describe("totpCode", () => {
    // RFC 6238 appendix B, SHA1 with the ASCII secret "12345678901234567890",
    // eight digits truncated to the last six.
    const secret = base32Encode(Buffer.from("12345678901234567890"));

    it("computes the RFC 6238 reference codes", () => {
      expect(totpCode(secret, totpStep(59 * 1000))).toBe("287082");
      expect(totpCode(secret, totpStep(1_111_111_109 * 1000))).toBe("081804");
      expect(totpCode(secret, totpStep(1_111_111_111 * 1000))).toBe("050471");
      expect(totpCode(secret, totpStep(1_234_567_890 * 1000))).toBe("005924");
      expect(totpCode(secret, totpStep(2_000_000_000 * 1000))).toBe("279037");
    });

    it("always answers six digits, zero-padded", () => {
      for (let step = 0; step < 200; step += 1) expect(totpCode(secret, step)).toMatch(/^\d{6}$/);
    });
  });

  describe("matchTotp", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const current = totpStep(now);

    it("accepts the current step's code and answers its step", () => {
      expect(matchTotp(secret, totpCode(secret, current), null, now)).toBe(current);
    });

    it("accepts one step either side, not two", () => {
      expect(matchTotp(secret, totpCode(secret, current - 1), null, now)).toBe(current - 1);
      expect(matchTotp(secret, totpCode(secret, current + 1), null, now)).toBe(current + 1);
      expect(matchTotp(secret, totpCode(secret, current - 2), null, now)).toBeNull();
      expect(matchTotp(secret, totpCode(secret, current + 2), null, now)).toBeNull();
    });

    it("ignores the spaces a code is typed with", () => {
      const code = totpCode(secret, current);
      expect(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, now)).toBe(current);
    });

    it("refuses anything that is not six digits", () => {
      expect(matchTotp(secret, "12345", null, now)).toBeNull();
      expect(matchTotp(secret, "1234567", null, now)).toBeNull();
      expect(matchTotp(secret, "abcdef", null, now)).toBeNull();
      expect(matchTotp(secret, "", null, now)).toBeNull();
    });

    it("refuses a code from a step already used, and the ones before it", () => {
      expect(matchTotp(secret, totpCode(secret, current), current, now)).toBeNull();
      expect(matchTotp(secret, totpCode(secret, current - 1), current, now)).toBeNull();
      expect(matchTotp(secret, totpCode(secret, current + 1), current, now)).toBe(current + 1);
    });

    it("refuses a wrong code", () => {
      const right = totpCode(secret, current);
      const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, "0");
      expect(matchTotp(secret, wrong, null, now)).toBeNull();
    });
  });

  describe("otpauthUri", () => {
    it("carries the label, the secret and the explicit parameters", () => {
      const uri = otpauthUri("someone@example.org", "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
      expect(uri.startsWith("otpauth://totp/Simply%20Mail%20Server%3Asomeone%40example.org?")).toBe(true);
      const params = new URL(uri).searchParams;
      expect(params.get("secret")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
      expect(params.get("issuer")).toBe("Simply Mail Server");
      expect(params.get("algorithm")).toBe("SHA1");
      expect(params.get("digits")).toBe("6");
      expect(params.get("period")).toBe("30");
    });
  });

  describe("recovery codes", () => {
    it("generates eight codes of ten characters with no ambiguous glyph", () => {
      const codes = generateRecoveryCodes();
      expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
      for (const code of codes)
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
      expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    });

    it("normalizes case, spaces and the dash away", () => {
      expect(normalizeRecoveryCode("abcde-fghjk")).toBe("ABCDEFGHJK");
      expect(normalizeRecoveryCode(" ABCDE FGHJK ")).toBe("ABCDEFGHJK");
      expect(normalizeRecoveryCode("ABCDEFGHJK")).toBe("ABCDEFGHJK");
    });

    it("hashes with the pepper, over the normalized code", () => {
      const expected = createHmac("sha256", `recovery:${PEPPER}`).update("ABCDEFGHJK").digest("hex");
      expect(hashRecoveryCode("abcde-fghjk", PEPPER)).toBe(expected);
      expect(hashRecoveryCode("ABCDEFGHJK", PEPPER)).toBe(expected);
      expect(hashRecoveryCode("ABCDEFGHJK", "other-pepper")).not.toBe(expected);
    });

    it("finds the index of the hash a typed code matches", () => {
      const codes = generateRecoveryCodes();
      const hashes = codes.map((code) => hashRecoveryCode(code, PEPPER));
      expect(matchRecoveryCode(codes[3]!, hashes, PEPPER)).toBe(3);
      expect(matchRecoveryCode(codes[3]!.toLowerCase().replace("-", " "), hashes, PEPPER)).toBe(3);
      expect(matchRecoveryCode(codes[0]!, hashes, "other-pepper")).toBe(-1);
    });

    it("answers -1 for a code of the wrong length without hashing", () => {
      const hashes = [hashRecoveryCode("ABCDEFGHJK", PEPPER)];
      expect(matchRecoveryCode("ABCDE", hashes, PEPPER)).toBe(-1);
      expect(matchRecoveryCode("ABCDEFGHJKL", hashes, PEPPER)).toBe(-1);
      expect(matchRecoveryCode("", hashes, PEPPER)).toBe(-1);
    });

    it("answers -1 when the code is spent or never existed", () => {
      expect(matchRecoveryCode("ABCDEFGHJK", [], PEPPER)).toBe(-1);
      expect(matchRecoveryCode("ABCDEFGHJK", [hashRecoveryCode("ZZZZZZZZZZ", PEPPER)], PEPPER)).toBe(-1);
    });
  });
});
