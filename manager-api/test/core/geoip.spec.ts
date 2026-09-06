import { describe, it, expect } from "vitest";
import { countriesFor, countryOf, locationOf } from "../../src/core/common/geoip";

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

describe("locationOf", () => {
  it("places an address, with the radius the dataset admits to being sure to within", async () => {
    const found = await locationOf("8.8.8.8");
    expect(found?.latitude).toBeGreaterThan(24);
    expect(found?.latitude).toBeLessThan(50);
    expect(found?.longitude).toBeLessThan(-60);
    expect(found?.accuracyKm).toBeGreaterThanOrEqual(0);
  });

  it("places an address arriving in its IPv6 mapped form the same way", async () => {
    expect(await locationOf("::ffff:8.8.8.8")).toEqual(await locationOf("8.8.8.8"));
  });

  // A dataset that answers Japan for 127.0.0.1 would turn every sign-in from a
  // reverse proxy into a trip abroad.
  it("places nothing on a private, reserved or unreadable address", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.28.0.5", "192.168.1.10", "", "not-an-ip", "1.2.3"]) {
      await expect(locationOf(address)).resolves.toBeNull();
    }
  });
});
