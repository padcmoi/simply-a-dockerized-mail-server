import { describe, it, expect } from "vitest";
import { PublicSuffixList } from "../../src/core/dmarc/public-suffix-list";

const LIST = new PublicSuffixList(
  ["// ===BEGIN ICANN DOMAINS===", "com", "uk", "co.uk", "*.ck", "!www.ck", "", "fr  // trailing note", "gouv.fr"].join("\n")
);

describe("PublicSuffixList", () => {
  it("counts the rules it read, comments and blank lines left out", () => {
    expect(LIST.size).toBe(7);
  });

  it("takes the longest matching rule as the public suffix", () => {
    expect(LIST.publicSuffix("mail.example.co.uk")).toBe("co.uk");
    expect(LIST.publicSuffix("example.com")).toBe("com");
    expect(LIST.publicSuffix("a.b.gouv.fr")).toBe("gouv.fr");
  });

  it("applies wildcards and their exceptions", () => {
    expect(LIST.publicSuffix("shop.foo.ck")).toBe("foo.ck");
    expect(LIST.publicSuffix("www.ck")).toBe("ck");
  });

  it("falls back to the last label for an unknown suffix", () => {
    expect(LIST.publicSuffix("host.example.zz")).toBe("zz");
  });

  it("finds the organizational domain one label under the suffix", () => {
    expect(LIST.organizationalDomain("mail.Example.co.uk.")).toBe("example.co.uk");
    expect(LIST.organizationalDomain("a.b.c.example.com")).toBe("example.com");
    expect(LIST.organizationalDomain("shop.foo.ck")).toBe("shop.foo.ck");
  });

  it("answers the domain itself when it is a public suffix", () => {
    expect(LIST.organizationalDomain("co.uk")).toBe("co.uk");
  });
});
