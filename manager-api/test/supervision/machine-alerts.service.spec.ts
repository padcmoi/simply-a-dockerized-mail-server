import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Account } from "../../src/core/entities/account.entity";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import { MACHINE_SATURATED, MachineAlertsService } from "../../src/core/supervision/machine-alerts.service";
import type { SystemSnapshot } from "../../src/core/supervision/system-metrics.service";
import { cpgMock, entity, providerMock, repoMock, type CpgMock } from "../helpers/mocks";

const ROOT = "root-id";
const WATCHER = "watcher-id";
const OUTSIDER = "outsider-id";

// Eight cores and a thousand bytes of memory: the ratios are what matters, and
// round numbers make the thresholds readable.
function snapshot(over: { load?: number; memoryUsed?: number; cores?: number } = {}): SystemSnapshot {
  return {
    at: 1_800_000_000_000,
    cores: over.cores ?? 8,
    cpu: 10,
    load: { one: over.load ?? 1, five: 1, fifteen: 1 },
    memory: { total: 1000, used: over.memoryUsed ?? 400 },
    network: { interface: "eth0", in: 100, out: 200 },
  };
}

const saturatedLoad = 8 * MACHINE_SATURATED;

describe("MachineAlertsService", () => {
  let notifications: ReturnType<typeof providerMock<NotificationsService>>;
  let dispatch: ReturnType<typeof vi.fn>;
  let cpg: CpgMock;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let svc: MachineAlertsService;

  beforeEach(() => {
    dispatch = vi.fn(async () => undefined);
    notifications = providerMock<NotificationsService>({ dispatch });
    cpg = cpgMock();
    cpg.guard.utils.check.global.mockResolvedValue(true);
    accounts = repoMock<Account>();
    accounts.find.mockResolvedValue([
      entity<Account>({ id: ROOT, enabled: 1, isRoot: 1 }),
      entity<Account>({ id: WATCHER, enabled: 1, isRoot: 0 }),
    ]);
    svc = new MachineAlertsService(notifications, cpg, accounts);
  });

  it("says nothing about a machine that is not red", async () => {
    await svc.inspect(snapshot({ load: 1, memoryUsed: 400 }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  // The load is read per core, which is the only way it means anything: 7 is
  // idle on an eight-thread host and desperate on a single-core one.
  it("notifies when the load per core goes red, carrying the figure and not a sentence", async () => {
    await svc.inspect(snapshot({ load: saturatedLoad }));
    expect(dispatch).toHaveBeenCalledWith({
      accountIds: [ROOT, WATCHER],
      source: "supervision",
      type: "machine-load",
      payload: { metric: "load", percent: 90 },
      link: "/admin/supervision",
    });
  });

  it("notifies when the memory goes red", async () => {
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "machine-memory", payload: { metric: "memory", percent: 95 } }));
  });

  // The machine is sampled every second: a figure that stays red would otherwise
  // be sixty notifications a minute.
  it("says it once and stays quiet while the figure stays red", async () => {
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    await svc.inspect(snapshot({ memoryUsed: 960 }));
    await svc.inspect(snapshot({ memoryUsed: 999 }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  // Re-armed under the raised threshold and not under the red one: a figure
  // hovering on 90 % crosses it both ways every few seconds.
  it("stays quiet on a figure falling back to raised, and speaks again once it has calmed down", async () => {
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    await svc.inspect(snapshot({ memoryUsed: 800 }));
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledTimes(1);

    await svc.inspect(snapshot({ memoryUsed: 500 }));
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("holds each figure on its own", async () => {
    await svc.inspect(snapshot({ load: saturatedLoad, memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls.map(([input]) => (input as { type: string }).type)).toEqual(["machine-load", "machine-memory"]);
  });

  // A notification about a machine nobody may look at has nowhere to lead, so
  // the pair the live window itself asks for is the pair that decides.
  it("reaches root and whoever may read the live figures, nobody else", async () => {
    accounts.find.mockResolvedValue([
      entity<Account>({ id: ROOT, enabled: 1, isRoot: 1 }),
      entity<Account>({ id: WATCHER, enabled: 1, isRoot: 0 }),
      entity<Account>({ id: OUTSIDER, enabled: 1, isRoot: 0 }),
    ]);
    cpg.guard.utils.check.global.mockImplementation(async (accountId: string) => accountId === WATCHER);

    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ accountIds: [ROOT, WATCHER] }));
    expect(cpg.guard.utils.check.global).toHaveBeenCalledWith(WATCHER, "supervision", "access");
    expect(cpg.guard.utils.check.global).toHaveBeenCalledWith(WATCHER, "supervision", "view-machine-metrics");
  });

  it("says nothing to nobody rather than dispatching an empty list", async () => {
    accounts.find.mockResolvedValue([]);
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  // The loop that watches the machine also writes its recorded history: a
  // notification that cannot be written must not stop it.
  it("swallows a failed notification, and stays armed for the next episode", async () => {
    dispatch.mockRejectedValueOnce(new Error("nope"));
    await expect(svc.inspect(snapshot({ memoryUsed: 950 }))).resolves.toBeUndefined();

    await svc.inspect(snapshot({ memoryUsed: 400 }));
    await svc.inspect(snapshot({ memoryUsed: 950 }));
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("reads nothing from a host reporting no cores or no memory", async () => {
    await svc.inspect(snapshot({ cores: 0, load: 99 }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
