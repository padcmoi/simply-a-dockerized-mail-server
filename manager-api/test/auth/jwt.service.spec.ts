import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { Account } from "../../src/core/entities/account.entity";
import { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { Group } from "../../src/core/entities/group.entity";
import { GroupMember } from "../../src/core/entities/group-member.entity";
import { RefreshToken } from "../../src/core/entities/refresh-token.entity";
import type { GeocodingService } from "../../src/core/geocoding/geocoding.service";
import type { MailSettingsService } from "../../src/core/mailer/mail-settings.service";
import { providerMock, qbMock, repoMock } from "../helpers/mocks";

// scryptVerify is the only crypto the login path relies on; stub it so tests stay
// pure and fast (no real hashing). Hoisted with an explicit signature so the mock
// exists before vi.mock replaces the module AND mockResolvedValue stays type-checked
// to a boolean.
const { verify } = vi.hoisted(() => ({ verify: vi.fn<(plain: string, stored: string) => Promise<boolean>>() }));
vi.mock("../../src/core/common/scrypt", () => ({ scryptVerify: verify }));

// One typed double per constructor argument, in order. Every dependency slots
// straight into the service constructor with no structural cast, so a wrong
// repository or a DTO that violates the business shape now fails `tsc`. The
// non-default behaviours the original plain mocks carried are reproduced here.
function makeMocks() {
  const accounts = repoMock<Account>();
  accounts.save.mockImplementation(async (x: object) => x);
  // repoMock.create already clones its input, so a later in-place mutation never
  // rewrites the argument vitest recorded for the call.
  const profiles = repoMock<AccountProfile>();
  profiles.save.mockImplementation(async (x: object) => x);
  const groups = repoMock<Group>();
  groups.findBy.mockResolvedValue([]);
  const groupMembers = repoMock<GroupMember>();
  groupMembers.find.mockResolvedValue([]);
  const refreshTokens = repoMock<RefreshToken>();
  refreshTokens.find.mockResolvedValue([]);
  refreshTokens.save.mockImplementation(async (x: object) => x);
  refreshTokens.insert.mockResolvedValue({ identifiers: [{ id: 1 }] });
  refreshTokens.update.mockResolvedValue(undefined);
  return {
    jwt: providerMock<JwtService>({ signAsync: vi.fn(async () => "access-token") }),
    accounts,
    profiles,
    groups,
    groupMembers,
    refreshTokens,
    geocoding: providerMock<GeocodingService>({ geocodeCity: vi.fn() }),
    mailSettings: providerMock<MailSettingsService>({ isEnabled: vi.fn(async () => false) }),
  };
}

describe("JwtAuthService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: JwtAuthService;

  beforeEach(() => {
    m = makeMocks();
    verify.mockReset();
    svc = new JwtAuthService(
      m.jwt,
      m.accounts,
      m.profiles,
      m.groups,
      m.groupMembers,
      m.refreshTokens,
      m.geocoding,
      m.mailSettings
    );
  });

  describe("login", () => {
    it("401 when no account matches", async () => {
      m.accounts.findOne.mockResolvedValueOnce(null);
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });
    it("401 when the account has no password set", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: null });
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 on a wrong password", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "scrypt$16384$8$1$salt$hash" });
      verify.mockResolvedValueOnce(false);
      await expect(svc.login("a@b.com", "pw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("verifies the password with scrypt", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "scrypt$16384$8$1$salt$hash", isRoot: 0 });
      verify.mockResolvedValueOnce(true);
      const res = await svc.login("a@b.com", "pw");
      expect(verify).toHaveBeenCalledWith("pw", "scrypt$16384$8$1$salt$hash");
      expect(res.accessToken).toBe("access-token");
    });
    it("issues tokens, records last login and persists the refresh token", async () => {
      const account = { id: "a1", email: "a@b.com", password: "hash", isRoot: 1 as const };
      m.accounts.findOne.mockResolvedValueOnce(account);
      verify.mockResolvedValueOnce(true);
      const res = await svc.login("a@b.com", "pw", "UA/1.0", "1.2.3.4");
      expect(res.accessToken).toBe("access-token");
      expect(typeof res.refreshToken).toBe("string");
      expect(res.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ lastLogin: expect.any(Date) }));
      // The access token is bound to its session (sid = the inserted row id).
      expect(m.jwt.signAsync).toHaveBeenCalledWith(
        { sub: "a1", email: "a@b.com", isRoot: true, sid: 1 },
        expect.objectContaining({ expiresIn: expect.any(Number) })
      );
      const inserted = m.refreshTokens.insert.mock.calls[0][0];
      expect(inserted).toMatchObject({ accountId: "a1", userAgent: "UA/1.0", ip: "1.2.3.4" });
      expect(inserted.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(inserted.expiresAt).toBeInstanceOf(Date);
    });
    it("stores null ua/ip when not provided", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "hash", isRoot: 0 });
      verify.mockResolvedValueOnce(true);
      await svc.login("a@b.com", "pw");
      expect(m.refreshTokens.insert.mock.calls[0][0]).toMatchObject({ userAgent: null, ip: null });
    });
    it("revokes the device's earlier live tokens first (one session per device)", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "hash", isRoot: 0 });
      verify.mockResolvedValueOnce(true);
      await svc.login("a@b.com", "pw", "UA/1.0", "1.2.3.4");
      expect(m.refreshTokens.update).toHaveBeenCalledTimes(1);
      const [criteria] = m.refreshTokens.update.mock.calls[0];
      expect(criteria).toMatchObject({ accountId: "a1", userAgent: "UA/1.0", ip: "1.2.3.4" });
    });
    it("skips device consolidation when no ua/ip fingerprint is available", async () => {
      m.accounts.findOne.mockResolvedValueOnce({ id: "a1", email: "a@b.com", password: "hash", isRoot: 0 });
      verify.mockResolvedValueOnce(true);
      await svc.login("a@b.com", "pw");
      expect(m.refreshTokens.update).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("401 when the token is unknown", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce(null);
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 when the token is already revoked", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        account: {},
      });
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("401 when the token has expired", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(Date.now() - 1000), account: {} });
      await expect(svc.refresh("raw")).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it("rotates the secret in place on the same row, without spawning a new session", async () => {
      const originalExpiry = new Date(Date.now() + 60_000);
      const stored = {
        tokenHash: "old-hash",
        revokedAt: null,
        expiresAt: originalExpiry,
        userAgent: "old-ua",
        ip: "0.0.0.0",
        account: { id: "a1", email: "a@b.com", isRoot: 0 },
      };
      m.refreshTokens.findOne.mockResolvedValueOnce(stored);
      const res = await svc.refresh("raw", "UA", "9.9.9.9");
      // same row, secret rotated, expiry slid, fingerprint refreshed, NOT revoked
      expect(stored.revokedAt).toBeNull();
      expect(m.refreshTokens.insert).not.toHaveBeenCalled();
      expect(m.refreshTokens.save).toHaveBeenCalledWith(stored);
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.tokenHash).not.toBe("old-hash");
      expect(stored.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
      expect(stored.userAgent).toBe("UA");
      expect(stored.ip).toBe("9.9.9.9");
      expect(res.accessToken).toBe("access-token");
      expect(typeof res.refreshToken).toBe("string");
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

  describe("listActiveSessions", () => {
    it("queries only live tokens (scoped to the account, newest first) and flags them active", async () => {
      const future = new Date(Date.now() + 100000);
      m.refreshTokens.find.mockResolvedValueOnce([
        { id: 1, userAgent: "UA", ip: "1.2.3.4", createdAt: new Date(), expiresAt: future, revokedAt: null },
      ]);
      const res = await svc.listActiveSessions("a1");
      const arg = m.refreshTokens.find.mock.calls[0][0];
      expect(arg.where).toMatchObject({ accountId: "a1" });
      expect(arg.order).toEqual({ createdAt: "DESC" });
      expect(res).toEqual([expect.objectContaining({ id: 1, active: true })]);
    });
    it("flags a session online when it was last seen within the last minute", async () => {
      const future = new Date(Date.now() + 100000);
      m.refreshTokens.find.mockResolvedValueOnce([
        { id: 1, expiresAt: future, revokedAt: null, lastSeenAt: new Date(Date.now() - 10_000) },
        { id: 2, expiresAt: future, revokedAt: null, lastSeenAt: new Date(Date.now() - 120_000) },
        { id: 3, expiresAt: future, revokedAt: null, lastSeenAt: null },
      ]);
      const res = await svc.listActiveSessions("a1");
      expect(res.map((s) => s.online)).toEqual([true, false, false]);
    });
  });

  describe("listSessionHistory", () => {
    // A chainable query-builder double: every builder method returns the same
    // object so the service's fluent chain works, and getManyAndCount yields
    // the [rows, total] pair.
    function makeQb(rows: unknown[], total: number) {
      const qb = qbMock<RefreshToken>();
      qb.getManyAndCount.mockResolvedValue([rows, total]);
      return qb;
    }

    it("paginates inactive tokens and maps them with active=false", async () => {
      const qb = makeQb(
        [{ id: 3, userAgent: "UA", ip: "1.2.3.4", createdAt: new Date(), expiresAt: new Date(), revokedAt: new Date() }],
        1
      );
      m.refreshTokens.createQueryBuilder.mockReturnValueOnce(qb);
      const res = await svc.listSessionHistory("a1", { offset: 0, limit: 10, sortDir: "desc" });
      expect(res.total).toBe(1);
      expect(res.items).toEqual([expect.objectContaining({ id: 3, active: false })]);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it("adds a search filter (user agent or IP) when provided", async () => {
      const qb = makeQb([], 0);
      m.refreshTokens.createQueryBuilder.mockReturnValueOnce(qb);
      await svc.listSessionHistory("a1", { offset: 0, limit: 25, sortDir: "asc", search: "chrome" });
      // account scope + inactive filter + search = 1 where + 2 andWhere.
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe("revokeSession", () => {
    it("404 when the session is unknown or owned by someone else", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce(null);
      await expect(svc.revokeSession("a1", 9)).rejects.toBeInstanceOf(NotFoundException);
      expect(m.refreshTokens.findOne).toHaveBeenCalledWith({ where: { id: 9, accountId: "a1" } });
    });
    it("is idempotent on an already-revoked session", async () => {
      m.refreshTokens.findOne.mockResolvedValueOnce({ id: 9, revokedAt: new Date() });
      await expect(svc.revokeSession("a1", 9)).resolves.toEqual({ ok: true });
      expect(m.refreshTokens.save).not.toHaveBeenCalled();
    });
    it("stamps revokedAt on a live session", async () => {
      const stored = { id: 9, revokedAt: null };
      m.refreshTokens.findOne.mockResolvedValueOnce(stored);
      await svc.revokeSession("a1", 9);
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

    it("saves the interface locale on the profile", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0 };
      const profile = { accountId: "a1", locale: null };
      m.accounts.findOne.mockResolvedValueOnce(account);
      m.profiles.findOne.mockResolvedValueOnce(profile).mockResolvedValueOnce({ ...profile, locale: "fr_FR" });
      const res = await svc.updateProfile("a1", { locale: "fr_FR" });
      expect(profile.locale).toBe("fr_FR");
      expect(m.profiles.save).toHaveBeenCalledWith(profile);
      expect(res.locale).toBe("fr_FR");
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
