import { describe, it, expect } from "vitest";
import { countriesFor, countryOf } from "../../src/core/common/geoip";

describe("geoip", () => {
  it("names the country an address was seen from", async () => {
    await expect(countryOf("8.8.8.8")).resolves.toBe("US");
  });

  it("reads an IPv4 address arriving in its IPv6 mapped form", async () => {
    await expect(countryOf("::ffff:8.8.8.8")).resolves.toBe("US");
  });

  it("says nothing rather than something wrong on a private or reserved address", async () => {
    for (const address of ["127.0.0.1", "::1", "10.1.2.3", "172.28.0.5", "192.168.1.10", "169.254.0.1"]) {
      await expect(countryOf(address)).resolves.toBe("");
    }
  });

  it("says nothing on an address it cannot read", async () => {
    for (const address of ["", "   ", "not-an-ip", "999.1.1.1", "1.2.3"]) {
      await expect(countryOf(address)).resolves.toBe("");
    }
  });

  it("resolves a page of rows once per distinct address", async () => {
    const found = await countriesFor(["8.8.8.8", "8.8.8.8", "127.0.0.1"]);

    expect(found.size).toBe(2);
    expect(found.get("8.8.8.8")).toBe("US");
    expect(found.get("127.0.0.1")).toBe("");
  });
});
