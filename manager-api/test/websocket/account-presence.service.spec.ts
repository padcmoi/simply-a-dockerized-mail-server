import { describe, it, expect, beforeEach } from "vitest";
import { AccountPresenceService } from "../../src/core/websocket/account-presence.service";
import type { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { entity, repoMock } from "../helpers/mocks";

describe("AccountPresenceService", () => {
  let repo: ReturnType<typeof repoMock<AccountProfile>>;
  let svc: AccountPresenceService;

  beforeEach(() => {
    repo = repoMock<AccountProfile>();
    repo.find.mockResolvedValue([]);
    repo.findOne.mockResolvedValue(null);
    repo.update.mockResolvedValue(undefined);
    repo.upsert.mockResolvedValue(undefined);
    svc = new AccountPresenceService(repo);
  });

  it("marks the profile online as 1, stamping when it flipped", async () => {
    await svc.setStatus("u1", true);
    expect(repo.upsert).toHaveBeenCalledWith(
      { accountId: "u1", presence: 1, presenceAt: expect.any(Date) },
      ["accountId"]
    );
  });

  it("writes offline as 0", async () => {
    await svc.setStatus("u1", false);
    expect(repo.upsert).toHaveBeenCalledWith(
      { accountId: "u1", presence: 0, presenceAt: expect.any(Date) },
      ["accountId"]
    );
  });

  describe("presenceState", () => {
    it("splits the online ids from the others' last-seen stamps", async () => {
      const seen = new Date("2026-07-23T08:00:00.000Z");
      repo.find.mockResolvedValue([
        entity<AccountProfile>({ accountId: "a", presence: 1, presenceAt: new Date() }),
        entity<AccountProfile>({ accountId: "b", presence: 0, presenceAt: seen }),
      ]);
      await expect(svc.presenceState()).resolves.toEqual({
        online: ["a"],
        lastSeen: { b: seen.toISOString() },
      });
    });

    // An account that never connected has nothing to report beyond being off.
    it("omits an offline account that was never seen", async () => {
      repo.find.mockResolvedValue([entity<AccountProfile>({ accountId: "b", presence: 0, presenceAt: null })]);
      await expect(svc.presenceState()).resolves.toEqual({ online: [], lastSeen: {} });
    });
  });

  it("lists the accounts flagged online, in one read", async () => {
    repo.find.mockResolvedValue([entity<AccountProfile>({ accountId: "a" }), entity<AccountProfile>({ accountId: "b" })]);
    await expect(svc.onlineAccountIds()).resolves.toEqual(["a", "b"]);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { presence: 1 } }));
  });

  it("answers a single account's status", async () => {
    repo.findOne.mockResolvedValue(entity<AccountProfile>({ accountId: "u1", presence: 1 }));
    await expect(svc.isOnline("u1")).resolves.toBe(true);
  });

  it("treats an account with no row as offline", async () => {
    await expect(svc.isOnline("u1")).resolves.toBe(false);
  });

  // Sockets die with the process: a leftover row would show a ghost as online
  // for as long as nobody reconnects.
  it("clears every online row at boot", async () => {
    await svc.onModuleInit();
    expect(repo.update).toHaveBeenCalledWith({ presence: 1 }, { presence: 0 });
  });
});
