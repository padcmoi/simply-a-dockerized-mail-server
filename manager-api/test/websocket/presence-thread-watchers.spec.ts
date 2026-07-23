import { describe, it, expect, vi } from "vitest";
import { presenceWatcher } from "../../src/core/websocket/watchers/presence.watcher";
import { ticketThreadWatcher } from "../../src/core/websocket/watchers/ticket-thread.watcher";
import type { AccountPresenceService } from "../../src/core/websocket/account-presence.service";
import type { TicketsService } from "../../src/api/tickets/tickets.service";
import { providerMock } from "../helpers/mocks";

describe("presenceWatcher", () => {
  // Presence has one source now: the account_presence table. The watcher only
  // relays it, it derives nothing of its own.
  it("serves exactly what the presence source reports", async () => {
    const state = { online: ["a", "c"], lastSeen: { b: "2026-07-23T08:00:00.000Z" } };
    const presence = providerMock<AccountPresenceService>({ presenceState: vi.fn().mockResolvedValue(state) });
    await expect(presenceWatcher(presence).fn()).resolves.toEqual(state);
  });

  it("serves an empty state when nobody is online", async () => {
    const empty = { online: [], lastSeen: {} };
    const presence = providerMock<AccountPresenceService>({ presenceState: vi.fn().mockResolvedValue(empty) });
    await expect(presenceWatcher(presence).fn()).resolves.toEqual(empty);
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
