import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Fail2banService } from "../../src/core/fail2ban/fail2ban.service";
import type { Fail2banDbService } from "../../src/core/fail2ban/fail2ban-db.service";
import { providerMock } from "../helpers/mocks";

function answer(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const BAN = { ip: "203.0.113.9", bannedAt: 1_000, expiresAt: 2_000 };
const ENTRY = {
  jail: "dovecot",
  ip: "203.0.113.9",
  bannedAt: 1_000,
  expiresAt: 2_000,
  banCount: 1,
  failures: 5,
  matches: ["line"],
};

describe("Fail2banService", () => {
  const fetchMock = vi.fn();
  let db: ReturnType<typeof providerMock<Fail2banDbService>>;
  let service: Fail2banService;

  function build(env: Record<string, string> = { FAIL2BAN_API_URL: "http://sidecar:1" }) {
    db = providerMock<Fail2banDbService>({
      jails: vi.fn(() => ["dovecot", "manager"]),
      bans: vi.fn(() => new Map([["dovecot", [BAN]]])),
      recentBans: vi.fn(() => new Map([["dovecot", 7]])),
      history: vi.fn(() => [ENTRY]),
    });
    return new Fail2banService(new ConfigService(env), db);
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    service = build();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds every jail from the database alone, asking fail2ban nothing", () => {
    expect(service.status()).toEqual({
      available: true,
      jails: [
        { name: "dovecot", currentlyBanned: 1, recentBans: 7, bantime: 3600, findtime: 300, maxretry: 5, bans: [BAN] },
        { name: "manager", currentlyBanned: 0, recentBans: 0, bantime: -1, findtime: 300, maxretry: 1, bans: [] },
      ],
      history: [ENTRY],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes the rule of the automatic jails from the installation's own settings", () => {
    const configured = build({ FAIL2BAN_BANTIME: "7200", FAIL2BAN_FINDTIME: "600", FAIL2BAN_MAXRETRY: "3" });
    const [dovecot, manager] = configured.status().jails;
    expect(dovecot).toMatchObject({ bantime: 7200, findtime: 600, maxretry: 3 });
    expect(manager).toMatchObject({ bantime: -1, findtime: 600, maxretry: 1 });
  });

  it("reports fail2ban unavailable when the database holds no jail", () => {
    db.jails.mockReturnValue([]);
    expect(service.status()).toEqual({ available: false, jails: [], history: [ENTRY] });
  });

  it("counts the bans of every jail for the supervision loop, from the database", () => {
    expect(service.latestBanned()).toEqual({ dovecot: 1, manager: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands back no ban count at all while the database holds no jail", () => {
    db.jails.mockReturnValue([]);
    expect(service.latestBanned()).toBeNull();
  });

  it("posts a ban to the permanent jail and answers that jail as the database now reads it", async () => {
    fetchMock.mockResolvedValue(answer(200, { jail: "manager" }));
    db.bans.mockReturnValue(new Map([["manager", [BAN]]]));
    expect(await service.ban("203.0.113.9")).toMatchObject({ name: "manager", currentlyBanned: 1, bantime: -1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://sidecar:1/ban");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ ip: "203.0.113.9" });
  });

  it("posts an unban to its jail and answers that jail as the database now reads it", async () => {
    fetchMock.mockResolvedValue(answer(200, { jail: "dovecot" }));
    db.bans.mockReturnValue(new Map());
    expect(await service.unban("dovecot", "203.0.113.9")).toMatchObject({ name: "dovecot", currentlyBanned: 0 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://sidecar:1/jails/dovecot/unban");
  });

  it("maps an unknown jail to 404", async () => {
    fetchMock.mockResolvedValue(answer(404, { error: "unknown jail" }));
    await expect(service.unban("nojail", "203.0.113.9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps a jail the database does not know to 404, whatever fail2ban answered", async () => {
    fetchMock.mockResolvedValue(answer(200, { jail: "gone" }));
    await expect(service.unban("gone", "203.0.113.9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps a refused address to 400", async () => {
    fetchMock.mockResolvedValue(answer(400, { error: "invalid ip" }));
    await expect(service.ban("203.0.113.9")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps a failing fail2ban to 503", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }));
    await expect(service.unban("dovecot", "203.0.113.9")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("maps an unreachable fail2ban to 503", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(service.ban("203.0.113.9")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("falls back to the bridge gateway when no URL is configured", async () => {
    const other = build({});
    fetchMock.mockResolvedValue(answer(200, { jail: "manager" }));
    await other.ban("203.0.113.9").catch(() => undefined);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://172.200.0.1:8081/ban");
  });
});
