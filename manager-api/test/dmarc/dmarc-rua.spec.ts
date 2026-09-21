import { describe, it, expect } from "vitest";
import { domainOf, parseRua, ruaTargets } from "../../src/core/dmarc/dmarc-rua";

describe("parseRua", () => {
  it("reads a mailto address", () => {
    expect(parseRua("mailto:DMARC@Example.com")).toEqual({ address: "dmarc@example.com", maxBytes: null });
  });

  it("reads a size limit in every unit", () => {
    expect(parseRua("mailto:a@example.com!500")?.maxBytes).toBe(500);
    expect(parseRua("mailto:a@example.com!10k")?.maxBytes).toBe(10 * 1024);
    expect(parseRua("mailto:a@example.com!10m")?.maxBytes).toBe(10 * 1024 ** 2);
    expect(parseRua("mailto:a@example.com!1g")?.maxBytes).toBe(1024 ** 3);
    expect(parseRua("mailto:a@example.com!1t")?.maxBytes).toBe(1024 ** 4);
  });

  it("ignores a size it cannot read", () => {
    expect(parseRua("mailto:a@example.com!big")?.maxBytes).toBeNull();
  });

  it("decodes an escaped address", () => {
    expect(parseRua("mailto:dmarc%2Breports@example.com")?.address).toBe("dmarc+reports@example.com");
  });

  it("refuses what is not a mail address", () => {
    expect(parseRua("https://example.com/report")).toBeNull();
    expect(parseRua("mailto:nobody")).toBeNull();
    expect(parseRua("mailto:%E0%A4%A@example.com")).toBeNull();
  });
});

describe("ruaTargets", () => {
  it("splits comma lists and keeps each address once, first limit winning", () => {
    expect(ruaTargets(["mailto:a@example.com!1k, mailto:b@example.com", "mailto:A@example.com!9m", "junk"])).toEqual([
      { address: "a@example.com", maxBytes: 1024 },
      { address: "b@example.com", maxBytes: null },
    ]);
  });
});

describe("domainOf", () => {
  it("takes the part after the last at sign, lower-cased", () => {
    expect(domainOf("Reports@Sub.Example.COM")).toBe("sub.example.com");
  });
});
