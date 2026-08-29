import { describe, it, expect, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHmac } from "crypto";
import type { CustomPermissionGuardService } from "../../src/core/custom-permission-guard/custom-permission-guard.service";
import { ApiTokenService } from "../../src/core/auth/api-token/api-token.service";
import { decryptSecret } from "../../src/core/auth/api-token/api-token.cipher";
import type { ApiToken } from "../../src/core/auth/api-token/api-token.entity";
import type { Account } from "../../src/core/entities/account.entity";
import { entity, repoMock, providerMock } from "../helpers/mocks";

const PEPPER = "test-pepper";
process.env.MANAGER_API_TOKEN_PEPPER = PEPPER;

// The service HMACs the raw secret with the pepper; recompute it the same way so
// a token double can carry a hash that verify() accepts (or, with a different
// secret, one it rejects).
const hashOf = (secret: string) => createHmac("sha256", PEPPER).update(secret).digest("hex");

// A typed TypeORM repository double: it slots straight into the service
// constructor with no structural cast. create() reads back the saved row's id
// and createdAt, so save echoes them.
function makeRepo() {
  const repo = repoMock<ApiToken>();
  repo.save.mockImplementation(async (x: object) => ({ id: 1, createdAt: new Date("2020-01-01T00:00:00.000Z"), ...x }));
  return repo;
}

// A full ApiToken row with a hash that matches `secret`, overridable per case.
function tokenFor(secret: string, over: Partial<ApiToken> = {}): ApiToken {
  return entity<ApiToken>({
    id: 1,
    accountId: "acc-1",
    clientId: "cid",
    secretHash: hashOf(secret),
    secretCipher: "",
    allowedIps: null,
    expiresAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    revokedAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    account: entity<Account>({ id: "acc-1", email: "a@b.com", isRoot: 0, enabled: 1 }),
    ...over,
  });
}

describe("ApiTokenService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: ApiTokenService;
  let cpg: CustomPermissionGuardService;

  beforeEach(() => {
    repo = makeRepo();
    // Scopes are refused when their author does not hold them, so the service
    // now asks the permission library. These specs mint unscoped keys, where it
    // is never consulted.
    cpg = providerMock<CustomPermissionGuardService>({});
    (cpg as { guard?: unknown }).guard = { assertOne: { global: vi.fn(), domain: vi.fn() } };
    svc = new ApiTokenService(repo, cpg);
  });

  describe("pepper", () => {
    it("throws when MANAGER_API_TOKEN_PEPPER is unset", async () => {
      const saved = process.env.MANAGER_API_TOKEN_PEPPER;
      delete process.env.MANAGER_API_TOKEN_PEPPER;
      try {
        await expect(svc.create("acc-1", false, { name: "x" })).rejects.toThrow("MANAGER_API_TOKEN_PEPPER");
      } finally {
        process.env.MANAGER_API_TOKEN_PEPPER = saved;
      }
    });
  });

  describe("create", () => {
    it("mints a sms_<clientId>.<secret> key and hashes the secret", async () => {
      const res = await svc.create("acc-1", false, { name: "ci" });
      expect(res.key).toMatch(/^sms_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      // the clientId embedded in the key is the one returned to the caller
      expect(res.key.startsWith(`sms_${res.clientId}.`)).toBe(true);
      // the raw secret is never persisted -- only its HMAC (64 hex chars)
      const persisted = repo.create.mock.calls[0][0] as Partial<ApiToken>;
      expect(persisted.secretHash).toMatch(/^[0-9a-f]{64}$/);
      const rawSecret = res.key.slice(`sms_${res.clientId}.`.length);
      expect(persisted.secretHash).toBe(hashOf(rawSecret));
      expect(res.allowedIps).toBeNull();
    });

    it("also seals the secret so it can be read back", async () => {
      const res = await svc.create("acc-1", false, { name: "ci" });
      const persisted = repo.create.mock.calls[0][0] as Partial<ApiToken>;
      const rawSecret = res.key.slice(`sms_${res.clientId}.`.length);
      expect(persisted.secretCipher).toMatch(/^v1\$/);
      expect(decryptSecret(persisted.secretCipher!, PEPPER)).toBe(rawSecret);
    });

    it("serialises allowedIps and parses expiresAt", async () => {
      const res = await svc.create("acc-1", false, { name: "ci", allowedIps: ["10.0.0.1"], expiresAt: "2030-01-01T00:00:00.000Z" });
      const persisted = repo.create.mock.calls[0][0] as Partial<ApiToken>;
      expect(persisted.allowedIps).toBe(JSON.stringify(["10.0.0.1"]));
      expect(persisted.expiresAt).toBeInstanceOf(Date);
      expect(res.allowedIps).toEqual(["10.0.0.1"]);
    });

    it("maps a duplicate-name DB error to 409", async () => {
      repo.save.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
      await expect(svc.create("acc-1", false, { name: "dup" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("rethrows an unexpected DB error", async () => {
      repo.save.mockRejectedValueOnce(new Error("boom"));
      await expect(svc.create("acc-1", false, { name: "x" })).rejects.toThrow("boom");
    });
  });

  describe("list", () => {
    it("returns safe views, ordered newest first, parsing allowedIps", async () => {
      repo.find.mockResolvedValueOnce([
        tokenFor("s", { id: 1, allowedIps: JSON.stringify(["1.2.3.4"]) }),
        tokenFor("s", { id: 2, allowedIps: null }),
      ]);
      const res = await svc.list("acc-1");
      expect(repo.find).toHaveBeenCalledWith({ where: { accountId: "acc-1" }, order: { createdAt: "DESC" } });
      expect(res[0].allowedIps).toEqual(["1.2.3.4"]);
      expect(res[1].allowedIps).toBeNull();
      // never leaks the secret hash
      expect((res[0] as Record<string, unknown>).secretHash).toBeUndefined();
    });
  });

  describe("update", () => {
    it("404 when the token is not owned / absent", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.update("acc-1", false, 1, { name: "n" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("applies name, allowedIps and expiresAt (set and cleared)", async () => {
      const row = tokenFor("s", { allowedIps: JSON.stringify(["9.9.9.9"]) });
      repo.findOne.mockResolvedValueOnce(row);
      await svc.update("acc-1", false, 1, { name: "renamed", allowedIps: null, expiresAt: null });
      expect(row.name).toBe("renamed");
      expect(row.allowedIps).toBeNull();
      expect(row.expiresAt).toBeNull();

      const row2 = tokenFor("s");
      repo.findOne.mockResolvedValueOnce(row2);
      await svc.update("acc-1", false, 1, { allowedIps: ["8.8.8.8"], expiresAt: "2031-01-01T00:00:00.000Z" });
      expect(row2.allowedIps).toBe(JSON.stringify(["8.8.8.8"]));
      expect(row2.expiresAt).toBeInstanceOf(Date);
    });

    it("maps a duplicate-name DB error to 409", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s"));
      repo.save.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
      await expect(svc.update("acc-1", false, 1, { name: "dup" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("rethrows an unexpected DB error", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s"));
      repo.save.mockRejectedValueOnce(new Error("boom"));
      await expect(svc.update("acc-1", false, 1, { name: "x" })).rejects.toThrow("boom");
    });
  });

  describe("reveal", () => {
    it("404 when the token is not this account's", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.reveal("acc-2", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hands back the very key that was minted, again and again", async () => {
      const created = await svc.create("acc-1", false, { name: "ci" });
      const persisted = repo.create.mock.calls[0][0] as Partial<ApiToken>;
      repo.findOne.mockResolvedValue(tokenFor("s", { clientId: created.clientId, secretCipher: persisted.secretCipher! }));

      await expect(svc.reveal("acc-1", 1)).resolves.toMatchObject({ key: created.key });
      await expect(svc.reveal("acc-1", 1)).resolves.toMatchObject({ key: created.key });
    });

    it("hands back the key regenerate minted, not the one it replaced", async () => {
      const row = tokenFor("s", { clientId: "keepme" });
      repo.findOne.mockResolvedValue(row);
      const regenerated = await svc.regenerate("acc-1", 1);

      await expect(svc.reveal("acc-1", 1)).resolves.toMatchObject({ key: regenerated.key });
    });

    it("gives a null key on a token minted before the cipher existed", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { secretCipher: "" }));
      await expect(svc.reveal("acc-1", 1)).resolves.toMatchObject({ key: null });
    });

    it("gives a null key when the pepper no longer opens it", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { secretCipher: "v1$aaaa$bbbb$cccc" }));
      await expect(svc.reveal("acc-1", 1)).resolves.toMatchObject({ key: null });
    });
  });

  describe("revoke", () => {
    it("404 when absent", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.revoke("acc-1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });
    it("400 when already revoked", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { revokedAt: new Date() }));
      await expect(svc.revoke("acc-1", 1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it("stamps revokedAt and returns the safe view", async () => {
      const row = tokenFor("s");
      repo.findOne.mockResolvedValueOnce(row);
      const res = await svc.revoke("acc-1", 1);
      expect(row.revokedAt).toBeInstanceOf(Date);
      expect(res.revokedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(row);
    });
  });

  describe("delete", () => {
    it("404 when absent", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.delete("acc-1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });
    it("400 when the token is not revoked first", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { revokedAt: null }));
      await expect(svc.delete("acc-1", 1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it("deletes a revoked token by id", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { id: 7, revokedAt: new Date() }));
      await svc.delete("acc-1", 7);
      expect(repo.delete).toHaveBeenCalledWith(7);
    });
  });

  describe("regenerate", () => {
    it("404 when absent", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.regenerate("acc-1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });
    it("400 when the token is revoked", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { revokedAt: new Date() }));
      await expect(svc.regenerate("acc-1", 1)).rejects.toBeInstanceOf(BadRequestException);
    });
    it("mints a fresh key on the same clientId and clears the lockout counters", async () => {
      const row = tokenFor("s", { clientId: "keepme", failedAttempts: 3, lockedUntil: new Date(), allowedIps: JSON.stringify(["1.1.1.1"]) });
      repo.findOne.mockResolvedValueOnce(row);
      const res = await svc.regenerate("acc-1", 1);
      expect(res.clientId).toBe("keepme");
      expect(res.key.startsWith("sms_keepme.")).toBe(true);
      expect(res.allowedIps).toEqual(["1.1.1.1"]);
      expect(row.failedAttempts).toBe(0);
      expect(row.lockedUntil).toBeNull();
      // the new secret's hash was stored, not the old one
      const rawSecret = res.key.slice("sms_keepme.".length);
      expect(row.secretHash).toBe(hashOf(rawSecret));
    });
    it("returns a null allow-list when the token carries none", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s", { clientId: "c2", allowedIps: null }));
      const res = await svc.regenerate("acc-1", 1);
      expect(res.allowedIps).toBeNull();
    });
  });

  describe("validate", () => {
    it("rejects a key without the sms_ prefix", async () => {
      expect(await svc.validate("bad_cid.secret", "1.2.3.4")).toBeNull();
    });
    it("rejects a key with no dot separator", async () => {
      expect(await svc.validate("sms_nodothere", "1.2.3.4")).toBeNull();
    });
    it("rejects an unknown clientId", async () => {
      repo.findOne.mockResolvedValueOnce(null);
      expect(await svc.validate("sms_cid.secret", "1.2.3.4")).toBeNull();
      expect(repo.findOne).toHaveBeenCalledWith({ where: { clientId: "cid" }, relations: ["account"] });
    });
    it("rejects a locked token", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s3cret", { lockedUntil: new Date(Date.now() + 60_000) }));
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
    });
    it("rejects an expired token", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s3cret", { expiresAt: new Date(Date.now() - 60_000) }));
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
    });
    it("rejects a revoked token", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s3cret", { revokedAt: new Date() }));
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
    });
    it("counts a wrong secret (length mismatch) as a failed attempt", async () => {
      const row = tokenFor("s3cret", { secretHash: "00", failedAttempts: 0 });
      repo.findOne.mockResolvedValueOnce(row);
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
      expect(row.failedAttempts).toBe(1);
      expect(row.lockedUntil).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(row);
    });
    it("locks the token once failed attempts reach the max", async () => {
      // equal-length but non-matching hash exercises the timing-safe compare
      const row = tokenFor("correct", { failedAttempts: 4 });
      repo.findOne.mockResolvedValueOnce(row);
      expect(await svc.validate("sms_cid.wrongwrong", "1.2.3.4")).toBeNull();
      expect(row.lockedUntil).toBeInstanceOf(Date);
      expect(row.failedAttempts).toBe(0);
    });
    it("rejects an IP outside the allow-list", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s3cret", { allowedIps: JSON.stringify(["9.9.9.9"]) }));
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
    });
    it("rejects a token on a disabled account", async () => {
      repo.findOne.mockResolvedValueOnce(tokenFor("s3cret", { account: entity<Account>({ id: "acc-1", email: "a@b.com", isRoot: 0, enabled: 0 }) }));
      expect(await svc.validate("sms_cid.s3cret", "1.2.3.4")).toBeNull();
    });
    it("accepts a valid key, normalises the IP through the allow-list, and stamps last use", async () => {
      const row = tokenFor("s3cret", {
        allowedIps: JSON.stringify(["1.2.3.4"]),
        account: entity<Account>({ id: "acc-1", email: "a@b.com", isRoot: 1, enabled: 1 }),
        failedAttempts: 2,
      });
      repo.findOne.mockResolvedValueOnce(row);
      // IPv4-mapped IPv6 must normalise to 1.2.3.4 so the allow-list matches
      const res = await svc.validate("sms_cid.s3cret", "::ffff:1.2.3.4");
      // A key with no scope carries the account's whole reach, which is what null says.
      expect(res).toEqual({ id: "acc-1", email: "a@b.com", isRoot: true, scopes: null });
      expect(row.lastUsedIp).toBe("1.2.3.4");
      expect(row.lastUsedAt).toBeInstanceOf(Date);
      expect(row.failedAttempts).toBe(0);
      expect(repo.save).toHaveBeenCalledWith(row);
    });
    it("accepts a valid key with an empty allow-list and maps a non-root account", async () => {
      const row = tokenFor("s3cret", { allowedIps: JSON.stringify([]) });
      repo.findOne.mockResolvedValueOnce(row);
      const res = await svc.validate("sms_cid.s3cret", "1.2.3.4");
      expect(res).toEqual({ id: "acc-1", email: "a@b.com", isRoot: false, scopes: null });
    });
  });
});
