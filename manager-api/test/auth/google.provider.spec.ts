import { describe, it, expect } from "vitest";
import { Strategy, type Profile } from "passport-google-oauth20";
import { googleProvider, toIdentity } from "../../src/core/auth/passport/providers/google.provider";
import { entity } from "../helpers/mocks";

const profile = (over: Partial<Profile> = {}) =>
  entity<Profile>({
    id: "sub-1",
    displayName: "Alice Martin",
    name: { givenName: " Alice ", familyName: " Martin " },
    emails: [{ value: " Alice@Example.COM ", verified: true }],
    photos: [{ value: "https://x/a.png" }],
    ...over,
  });

describe("googleProvider", () => {
  it("builds a strategy from credentials read at runtime, not from the environment", () => {
    const strategy = googleProvider.create({ clientId: "cid", clientSecret: "secret" });
    expect(strategy).toBeInstanceOf(Strategy);
    expect(googleProvider.id).toBe("google");
    // Identity only: this signs someone in, it never asks to read their account.
    expect(googleProvider.scope).toEqual(["openid", "email", "profile"]);
  });

  describe("toIdentity", () => {
    it("normalizes the payload, trimming and lowercasing the address", () => {
      expect(toIdentity(profile())).toEqual({
        provider: "google",
        subject: "sub-1",
        email: "alice@example.com",
        emailVerified: true,
        firstName: "Alice",
        lastName: "Martin",
        picture: "https://x/a.png",
      });
    });

    it("reports an unverified address as such, so the service never matches an account on it", () => {
      const emails: Profile["emails"] = [{ value: "a@b.com", verified: false }];
      expect(toIdentity(profile({ emails })).emailVerified).toBe(false);
    });

    it("nulls what the payload leaves out rather than inventing it", () => {
      expect(toIdentity(profile({ name: undefined, emails: undefined, photos: undefined }))).toMatchObject({
        email: "",
        emailVerified: false,
        firstName: null,
        lastName: null,
        picture: null,
      });
    });

    it("nulls a name made only of spaces", () => {
      const empty: Profile["name"] = { givenName: "   ", familyName: "" };
      expect(toIdentity(profile({ name: empty }))).toMatchObject({ firstName: null, lastName: null });
    });
  });
});
