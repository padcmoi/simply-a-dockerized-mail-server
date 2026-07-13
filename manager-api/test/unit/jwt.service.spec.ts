import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";

// bcrypt.compare is the only crypto the login path relies on; stub it so tests
// stay pure and fast (no real hashing).
vi.mock("bcrypt", () => ({ compare: vi.fn() }));
const compare = vi.mocked(bcrypt.compare);

function makeMocks() {
  return {
    jwt: { signAsync: vi.fn().mockResolvedValue("access-token") },
    accounts: { findOne: vi.fn(), save: vi.fn((x) => Promise.resolve(x)) },
    // clone on create so a later in-place mutation does not rewrite the
    // argument vitest recorded for the call.
    profiles: { findOne: vi.fn(), create: vi.fn((x) => ({ ...x })), save: vi.fn((x) => Promise.resolve(x)) },
    groups: { findBy: vi.fn().mockResolvedValue([]) },
    groupMembers: { find: vi.fn().mockResolvedValue([]) },
    refreshTokens: { findOne: vi.fn(), save: vi.fn((x) => Promise.resolve(x)), insert: vi.fn().mockResolvedValue(undefined) },
    geocoding: { geocodeCity: vi.fn() },
  };
}

describe("JwtAuthService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: JwtAuthService;

  beforeEach(() => {
    m = makeMocks();
    compare.mockReset();
    svc = new JwtAuthService(
      m.jwt as never,
      m.accounts as never,
      m.profiles as never,
      m.groups as never,
      m.groupMembers as never,
      m.refreshTokens as never,
      m.geocoding as never
    );
  });

  describe("login", () => {
    it("401 when no account matches", async () => {
      m.accounts.findOne.mockResolvedValueOnce(null);
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(compare).not.toHaveBeenCalled();
    });
    it("401 when the account has no password set", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: null });
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 on a wrong password", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "hash" });
      compare.mockResolvedValueOnce(false as never);
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("issues tokens, records last login and persists the refresh token", async () => {
      const account = { id: "a1", email: "a@b.com", password: "hash", isRoot: 1 as const };
      m.accounts.findOne.mockResolvedValueOnce(account);
      compare.mockResolvedValueOnce(true as never);
      const res = await svc.login("a@b.com", "pw", "UA/1.0", "1.2.3.4");
      expect(res.accessToken).toBe("access-token");
      expect(typeof res.refreshToken).toBe("string");
      expect(res.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ lastLogin: expect.any(Date) }));
      expect(m.jwt.signAsync).toHaveBeenCalledWith(
        { sub: "a1", email: "a@b.com", isRoot: true },
        expect.objectContaining({ expiresIn: expect.any(Number) })
      );
      const inserted = m.refreshTokens.insert.mock.calls[0][0];
      expect(inserted).toMatchObject({ accountId: "a1", userAgent: "UA/1.0", ip: "1.2.3.4" });
      expect(inserted.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(inserted.expiresAt).toBeInstanceOf(Date);
    });
    it("stores null ua/ip when not provided", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "hash", isRoot: 0 });
      compare.mockResolvedValueOnce(true as never);
      await svc.login("a@b.com", "pw");
      expect(m.refreshTokens.insert.mock.calls[0][0]).toMatchObject({ userAgent: null, ip: null });
    });
  });

  describe("refresh", () => {
    it("401 when the token is unknown", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce(null);
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 when the token is already revoked", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 1000), account: {} });
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 when the token has expired", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(Date.now() - 1000), account: {} });
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("rotates the token and issues a fresh pair", async () => {
      const stored = {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: { id: "a1", email: "a@b.com", isRoot: 0 },
      };
      m.refreshTokens.findOne.mockResolvedValueOnce(stored);
      const res = await svc.refresh("raw", "UA", "9.9.9.9");
      expect(stored.revokedAt).toBeInstanceOf(Date);
      expect(m.refreshTokens.save).toHaveBeenCalledWith(stored);
      expect(res.accessToken).toBe("access-token");
      expect(m.refreshTokens.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("revoke", () => {
    it("is a no-op when the token is unknown", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce(null);
      await svc.revoke("raw");
      expect(m.refreshTokens.save).not.toHaveBeenCalled();
    });
    it("is a no-op when the token is already revoked", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({ revokedAt: new Date() });
      await svc.revoke("raw");
      expect(m.refreshTokens.save).not.toHaveBeenCalled();
    });
    it("stamps revokedAt on a live token", async () => {
      const stored = { revokedAt: null };
      m.refreshTokens.findOne.mockResolvedValueOnce(stored);
      await svc.revoke("raw");
      expect(stored.revokedAt).toBeInstanceOf(Date);
      expect(m.refreshTokens.save).toHaveBeenCalledWith(stored);
    });
  });

  describe("me", () => {
    it("404 when the account is gone", async () => {
      m.accounts.findOne.mockResolvedValueOnce(null);
      await expect(svc.me("a1")).rejects.toBeInstanceOf(NotFoundException);
    });
    it("returns a null-filled profile with no groups", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValueOnce(null);
      const res = await svc.me("a1");
      expect(res).toMatchObject({ email: "a@b.com", displayName: null, latitude: null, isRoot: false, groups: [] });
      expect(m.groups.findBy).not.toHaveBeenCalled();
    });
    it("hydrates profile fields and group memberships", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", isRoot: 1 });
      m.profiles.findOne.mockResolvedValueOnce({ displayName: "Bob", city: "Paris", latitude: "48.8", longitude: "2.3" });
      m.groupMembers.find.mockResolvedValueOnce([{ groupId: "g1" }]);
      m.groups.findBy.mockResolvedValueOnce([{ id: "g1", name: "Admins" }]);
      const res = await svc.me("a1");
      expect(res).toMatchObject({ displayName: "Bob", city: "Paris", isRoot: true, groups: [{ id: "g1", name: "Admins" }] });
    });
  });

  describe("updateProfile", () => {
    it("404 when the account is gone", async () => {
      m.accounts.findOne.mockResolvedValueOnce(null);
      await expect(svc.updateProfile("a1", { displayName: "x" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("409 when the new email is taken by another account", async () => {
      m.accounts.findOne
        .mockResolvedValueOnce({ id: "a1", email: "old@b.com", isRoot: 0 })
        .mockResolvedValueOnce({ id: "other", email: "new@b.com" });
      await expect(svc.updateProfile("a1", { email: "new@b.com" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("changes the email and creates a fresh profile row when none exists", async () => {
      const account = { id: "a1", email: "old@b.com", isRoot: 0 };
      m.accounts.findOne.mockResolvedValueOnce(account).mockResolvedValueOnce(null);
      m.profiles.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const res = await svc.updateProfile("a1", { email: "new@b.com", displayName: "Bob" });
      expect(account.email).toBe("new@b.com");
      expect(m.accounts.save).toHaveBeenCalledWith(account);
      expect(m.profiles.create).toHaveBeenCalledWith({ accountId: "a1" });
      expect(res.email).toBe("new@b.com");
      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
    });

    it("geocodes a set city into coordinates", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0 };
      const profile = { accountId: "a1", city: null, country: null, latitude: null, longitude: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(profile);
      m.geocoding.geocodeCity.mockResolvedValueOnce({ latitude: "48.8", longitude: "2.3" });
      const res = await svc.updateProfile("a1", { city: "Paris", country: "France" });
      expect(m.geocoding.geocodeCity).toHaveBeenCalledWith("Paris", "France");
      expect(res.latitude).toBe("48.8");
      expect(res.longitude).toBe("2.3");
    });

    it("nulls the coordinates when geocoding fails", async () => {
      const profile = { accountId: "a1", city: null, country: null, latitude: "1", longitude: "2" };
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValue(profile);
      m.geocoding.geocodeCity.mockResolvedValueOnce(null);
      const res = await svc.updateProfile("a1", { city: "Nowhere" });
      expect(res.latitude).toBeNull();
      expect(res.longitude).toBeNull();
    });

    it("clears the coordinates when the city is cleared", async () => {
      const profile = { accountId: "a1", city: "Paris", country: null, latitude: "48.8", longitude: "2.3" };
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValue(profile);
      const res = await svc.updateProfile("a1", { city: null });
      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
      expect(res.latitude).toBeNull();
    });

    it("re-geocodes on a country change when a city is already set", async () => {
      const profile = { accountId: "a1", city: "Lyon", country: null, latitude: null, longitude: null };
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValue(profile);
      m.geocoding.geocodeCity.mockResolvedValueOnce({ latitude: "45.7", longitude: "4.8" });
      await svc.updateProfile("a1", { country: "France" });
      expect(m.geocoding.geocodeCity).toHaveBeenCalledWith("Lyon", "France");
    });

    it("skips geocoding for a non-location field", async () => {
      const profile = { accountId: "a1", city: null, country: null };
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValue(profile);
      await svc.updateProfile("a1", { phone: "+33 1 23" });
      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
    });

    it("assigns every optional profile attribute that is present", async () => {
      const profile = { accountId: "a1", city: null, country: null };
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0 });
      m.profiles.findOne.mockResolvedValue(profile);
      const res = await svc.updateProfile("a1", {
        avatarUrl: "https://x/y.png",
        phone: "+33 1",
        addressLine: "1 rue",
        addressComplement: "apt 2",
        postalCode: "75001",
      });
      expect(res).toMatchObject({
        avatarUrl: "https://x/y.png",
        phone: "+33 1",
        addressLine: "1 rue",
        addressComplement: "apt 2",
        postalCode: "75001",
      });
      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
    });
  });
});
