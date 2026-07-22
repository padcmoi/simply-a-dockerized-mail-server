import { describe, it, expect, vi } from "vitest";
import { presenceWatcher } from "../../src/core/websocket/watchers/presence.watcher";
import { ticketThreadWatcher } from "../../src/core/websocket/watchers/ticket-thread.watcher";
import { PresenceActivityService } from "../../src/core/websocket/presence-activity.service";
import type { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import type { TicketsService } from "../../src/api/tickets/tickets.service";
import { providerMock } from "../helpers/mocks";

describe("presenceWatcher", () => {
  it("drops the accounts reported away from the online list", async () => {
    const sessions = providerMock<JwtAuthService>({ onlineAccountIds: vi.fn().mockResolvedValue(["a", "b", "c"]) });
    const activity = new PresenceActivityService();
    const socket = {};
    activity.join("b", socket);
    activity.setActive("b", socket, false);
    const w = presenceWatcher(sessions, activity);
    await expect(w.fn()).resolves.toEqual(["a", "c"]);
  });

  it("keeps everyone when nobody is away", async () => {
    const sessions = providerMock<JwtAuthService>({ onlineAccountIds: vi.fn().mockResolvedValue(["a"]) });
    const w = presenceWatcher(sessions, new PresenceActivityService());
    await expect(w.fn()).resolves.toEqual(["a"]);
  });
});

describe("ticketThreadWatcher", () => {
  it("serves the thread for its parameter", async () => {
    const tickets = providerMock<TicketsService>({ thread: vi.fn().mockResolvedValue({ id: 9 }) });
    const w = ticketThreadWatcher(tickets);
    await expect(w.fn("9")).resolves.toEqual({ id: 9 });
    expect(tickets.thread).toHaveBeenCalledWith(9);
  });

  it("delegates the subscribe decision to canWatch with the numeric id", async () => {
    const tickets = providerMock<TicketsService>({ canWatch: vi.fn().mockResolvedValue(true) });
    const w = ticketThreadWatcher(tickets);
    await expect(w.authorize!({ userId: "u1", isRoot: false }, "9")).resolves.toBe(true);
    expect(tickets.canWatch).toHaveBeenCalledWith(9, { userId: "u1", isRoot: false });
  });

  it("refuses a non-numeric parameter without calling the service", async () => {
    const tickets = providerMock<TicketsService>({ canWatch: vi.fn() });
    const w = ticketThreadWatcher(tickets);
    await expect(w.authorize!({ userId: "u1", isRoot: false }, "nope")).resolves.toBe(false);
    expect(tickets.canWatch).not.toHaveBeenCalled();
  });
});
