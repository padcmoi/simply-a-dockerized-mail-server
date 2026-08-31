import { describe, it, expect, vi, beforeEach } from "vitest";

let call: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
});

const { useMachineAlerts } = await import("~/composables/useMachineAlerts");

describe("useMachineAlerts", () => {
  it("reads the machine's own row out of the preferences", async () => {
    call.mockResolvedValue({ support: { inApp: true, email: true }, supervision: { inApp: true, email: false } });
    const alerts = useMachineAlerts();
    await alerts.read();

    expect(call).toHaveBeenCalledWith("/notifications/preferences");
    expect(alerts.enabled.value).toBe(true);
  });

  // An account that never said anything is not warned: a red figure is a fact
  // about the host rather than about anyone's work.
  it("stays off for an API that carries no machine row at all", async () => {
    call.mockResolvedValue({ support: { inApp: true, email: true } });
    const alerts = useMachineAlerts();
    await alerts.read();
    expect(alerts.enabled.value).toBe(false);
  });

  // This switch says whether the interface warns, and nothing about what lands
  // in a mailbox: the email channel is written back exactly as it was read.
  it("switches the in-app channel and carries the email one through untouched", async () => {
    call.mockResolvedValueOnce({ supervision: { inApp: false, email: true } });
    const alerts = useMachineAlerts();
    await alerts.read();

    call.mockResolvedValueOnce({ supervision: { inApp: true, email: true } });
    await expect(alerts.toggle()).resolves.toBe(true);

    expect(call).toHaveBeenLastCalledWith("/notifications/preferences", {
      method: "PUT",
      body: { source: "supervision", inApp: true, email: true },
    });
    expect(alerts.enabled.value).toBe(true);
  });

  it("switches it back off", async () => {
    call.mockResolvedValueOnce({ supervision: { inApp: true, email: false } });
    const alerts = useMachineAlerts();
    await alerts.read();

    call.mockResolvedValueOnce({ supervision: { inApp: false, email: false } });
    await alerts.toggle();

    expect(call).toHaveBeenLastCalledWith("/notifications/preferences", {
      method: "PUT",
      body: { source: "supervision", inApp: false, email: false },
    });
    expect(alerts.enabled.value).toBe(false);
  });

  // The button says what the API holds, so a refused write leaves it where it
  // was rather than showing a state nobody stored.
  it("keeps the switch where it was when the write was refused", async () => {
    call.mockResolvedValueOnce({ supervision: { inApp: true, email: false } });
    const alerts = useMachineAlerts();
    await alerts.read();

    call.mockRejectedValueOnce(new Error("nope"));
    await expect(alerts.toggle()).resolves.toBe(false);
    expect(alerts.enabled.value).toBe(true);
    expect(alerts.saving.value).toBe(false);
  });
});
