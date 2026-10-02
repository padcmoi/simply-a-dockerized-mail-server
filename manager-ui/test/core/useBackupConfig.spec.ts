import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBackupConfig } from "~/composables/useBackupConfig";

vi.mock("~/utils/zoneTime", async (original) => ({
  ...(await original<typeof import("~/utils/zoneTime")>()),
  viewerZone: () => "Europe/Paris",
}));

const config = {
  time: "02:30",
  keepDays: 5,
  dir: "./backup",
  offsite: "",
  offsiteDeleteLocal: true,
  timezone: "Etc/UTC",
  publishedAt: null,
};
const overviewOf = (over: Partial<BackupOverview> = {}): BackupOverview => ({
  configured: true,
  config,
  pending: false,
  lastRequest: null,
  lastRun: null,
  projectReadable: true,
  retrieval: null,
  ...over,
});

let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
  call = vi.fn(async () => overviewOf());
  add = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (err: unknown) => String(err) }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("onBeforeUnmount", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useBackupConfig", () => {
  it("shows the server time on the viewer's own clock, with nothing to save", async () => {
    const { form, zone, serverZone, serverTime, valid, configured, load } = useBackupConfig();
    await load();
    expect(call).toHaveBeenCalledWith("/backups");
    expect(configured.value).toBe(true);
    expect(zone).toBe("Europe/Paris");
    expect(serverZone.value).toBe("Etc/UTC");
    expect(form).toEqual({ time: "04:30", keepDays: 5, offsite: "", offsiteDeleteLocal: true });
    expect(serverTime.value).toBe("02:30");
    expect(valid.value).toBe(false);
  });

  it("shows the same time when the server and the viewer share a zone", async () => {
    call.mockResolvedValue(overviewOf({ config: { ...config, timezone: "Europe/Paris" } }));
    const { form, serverTime, load } = useBackupConfig();
    await load();
    expect(form.time).toBe("02:30");
    expect(serverTime.value).toBe("02:30");
  });

  it("says the backup is not configured when the server published nothing", async () => {
    call.mockResolvedValue(overviewOf({ configured: false, config: null }));
    const { configured, valid, load } = useBackupConfig();
    await load();
    expect(configured.value).toBe(false);
    expect(valid.value).toBe(false);
  });

  it("refuses a time, a number of backups or a destination the server would refuse", async () => {
    const { form, timeError, keepDaysError, offsiteError, valid, load } = useBackupConfig();
    await load();
    form.time = "25:00";
    expect(timeError.value).toBe("backups.config.timeInvalid");
    form.time = "05:00";
    form.keepDays = 0;
    expect(keepDaysError.value).toBe("backups.config.keepDaysInvalid");
    form.keepDays = 1.5;
    expect(keepDaysError.value).toBe("backups.config.keepDaysInvalid");
    form.keepDays = 7;
    for (const bad of ["/mnt/disk", "bob@host", "bob@host:/srv; rm -rf /", "bob@host:relative"]) {
      form.offsite = bad;
      expect(offsiteError.value, bad).toBe("backups.config.offsiteInvalid");
      expect(valid.value, bad).toBe(false);
    }
    form.offsite = "bob@backup.example.com:/srv/mail";
    expect(offsiteError.value).toBeUndefined();
    expect(valid.value).toBe(true);
  });

  it("sends the server the time on its own clock, whatever the viewer typed on theirs", async () => {
    const { form, serverTime, valid, pending, load, save } = useBackupConfig();
    await load();
    form.time = "14:30";
    form.offsite = " bob@backup.example.com:/srv/mail ";
    form.offsiteDeleteLocal = false;
    expect(serverTime.value).toBe("12:30");
    call.mockResolvedValueOnce(overviewOf({ pending: true }));
    await save();
    expect(call).toHaveBeenLastCalledWith("/backups/config", {
      method: "PUT",
      body: { time: "12:30", keepDays: 5, offsite: "bob@backup.example.com:/srv/mail", offsiteDeleteLocal: false },
    });
    expect(pending.value).toBe(true);
    expect(valid.value).toBe(false);
    expect(form.time).toBe("14:30");
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "backups.config.requested", color: "success" }));
  });

  it("crosses midnight when the viewer's evening is the server's next day", async () => {
    const { form, serverTime, load } = useBackupConfig();
    await load();
    form.time = "01:15";
    expect(serverTime.value).toBe("23:15");
  });

  it("keeps what was typed and reports the error when the server refuses", async () => {
    const { form, load, save } = useBackupConfig();
    await load();
    form.keepDays = 9;
    call.mockRejectedValueOnce(new Error("boom"));
    await save();
    expect(form.keepDays).toBe(9);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "backups.config.saveFailed", color: "error" }));
  });
});
