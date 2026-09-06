import { describe, it, expect } from "vitest";
import { hashAnswer, matchAnswer, normaliseAnswer } from "../../src/core/auth/mfa/security-answer";

const PEPPER = "pepper-under-test";

describe("normaliseAnswer", () => {
  it("drops the case, the accents and the spacing around and inside", () => {
    expect(normaliseAnswer("  JoËl  ")).toBe("joel");
    expect(normaliseAnswer("Jean   Pierre")).toBe("jean pierre");
  });

  it("keeps everything else, punctuation included", () => {
    expect(normaliseAnswer("Saint-Tropez")).toBe("saint-tropez");
    expect(normaliseAnswer("l'école")).toBe("l'ecole");
  });
});

describe("hashAnswer", () => {
  it("gives the same hash to the same answer written differently", () => {
    expect(hashAnswer("Joël", PEPPER)).toBe(hashAnswer(" joel ", PEPPER));
  });

  it("gives a different hash to a different answer", () => {
    expect(hashAnswer("Joel", PEPPER)).not.toBe(hashAnswer("Michel", PEPPER));
  });

  it("gives a different hash under another pepper, so a dump alone is not enough", () => {
    expect(hashAnswer("Joel", PEPPER)).not.toBe(hashAnswer("Joel", "another-pepper"));
  });

  it("never carries the answer itself", () => {
    expect(hashAnswer("Joel", PEPPER)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("matchAnswer", () => {
  const stored = hashAnswer("Joël", PEPPER);

  it("accepts the answer whatever its case, accents or spacing", () => {
    expect(matchAnswer("joel", stored, PEPPER)).toBe(true);
    expect(matchAnswer("  JOEL ", stored, PEPPER)).toBe(true);
  });

  it("refuses another answer", () => {
    expect(matchAnswer("michel", stored, PEPPER)).toBe(false);
  });

  it("refuses the right answer under the wrong pepper", () => {
    expect(matchAnswer("joel", stored, "another-pepper")).toBe(false);
  });

  it("refuses a stored value of the wrong length rather than throwing", () => {
    expect(matchAnswer("joel", "too-short", PEPPER)).toBe(false);
  });
});
