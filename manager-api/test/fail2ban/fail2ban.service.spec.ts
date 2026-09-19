import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Fail2banService } from "../../src/core/fail2ban/fail2ban.service";

function answer(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Fail2banService", () => {
  const fetchMock = vi.fn();
  const service = new Fail2banService(new ConfigService({ FAIL2BAN_API_URL: "http://sidecar:1" }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the jails and the history from the sidecar", async () => {
    fetchMock.mockResolvedValue(answer(200, { jails: [{ name: "dovecot" }], history: [{ ip: "203.0.113.9" }] }));
    expect(await service.status()).toEqual({ available: true, jails: [{ name: "dovecot" }], history: [{ ip: "203.0.113.9" }] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://sidecar:1/status");
  });

  it("reads an older sidecar that sends no history as an empty one", async () => {
    fetchMock.mockResolvedValue(answer(200, { jails: [] }));
    expect(await service.status()).toEqual({ available: true, jails: [], history: [] });
  });

  it("reports fail2ban unavailable rather than throwing when the sidecar is out of reach", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await service.status()).toEqual({ available: false, jails: [], history: [] });
  });

  it("reports fail2ban unavailable when the sidecar answers an error", async () => {
    fetchMock.mockResolvedValue(answer(503, { error: "fail2ban did not answer" }));
    expect(await service.status()).toEqual({ available: false, jails: [], history: [] });
  });

  it("posts a ban to the permanent jail with the address in the body and hands back that jail", async () => {
    fetchMock.mockResolvedValue(answer(200, { name: "manager", currentlyBanned: 1 }));
    expect(await service.ban("203.0.113.9")).toEqual({ name: "manager", currentlyBanned: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://sidecar:1/ban");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ ip: "203.0.113.9" });
  });

  it("posts an unban to the unban endpoint", async () => {
    fetchMock.mockResolvedValue(answer(200, { name: "dovecot" }));
    await service.unban("dovecot", "203.0.113.9");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://sidecar:1/jails/dovecot/unban");
  });

  it("maps an unknown jail to 404", async () => {
    fetchMock.mockResolvedValue(answer(404, { error: "unknown jail" }));
    await expect(service.unban("nojail", "203.0.113.9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps a refused address to 400", async () => {
    fetchMock.mockResolvedValue(answer(400, { error: "invalid ip" }));
    await expect(service.ban("203.0.113.9")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps a failing fail2ban to 503", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }));
    await expect(service.unban("dovecot", "203.0.113.9")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("maps an unreachable sidecar to 503", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(service.ban("203.0.113.9")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("hands back the last ban counts at once and refreshes them in the background every ten seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const counting = new Fail2banService(new ConfigService({ FAIL2BAN_API_URL: "http://sidecar:1" }));
    fetchMock.mockResolvedValue(answer(200, { banned: { dovecot: 2, manager: 1 } }));

    expect(counting.latestBanned()).toBeNull();
    await vi.waitFor(() => expect(counting.latestBanned()).toEqual({ dovecot: 2, manager: 1 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://sidecar:1/banned");

    vi.setSystemTime(1_800_000_005_000);
    counting.latestBanned();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_800_000_011_000);
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    counting.latestBanned();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(counting.latestBanned()).toBeNull());
    vi.useRealTimers();
  });

  it("falls back to the bridge gateway when no URL is configured", async () => {
    fetchMock.mockResolvedValue(answer(200, { jails: [] }));
    await new Fail2banService(new ConfigService({})).status();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://172.200.0.1:8081/status");
  });
});
