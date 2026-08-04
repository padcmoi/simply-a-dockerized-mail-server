import { describe, it, expect, vi, beforeEach } from "vitest";

// `onMounted` is not involved here: the page loads through useAsyncData, so
// every spec calls `load()` the way the page does.
let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn().mockResolvedValue({ supervisionRetentionMs: 30 * 86_400_000 });
  add = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (e: unknown) => String(e) }));
});

const { useSupervisionRetention, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } = await import("~/composables/useSupervisionRetention");

describe("useSupervisionRetention", () => {
  // Nobody sets a retention in milliseconds, and the API is the only place that
  // has to speak in them.
  it("reads the stored milliseconds as days", async () => {
    call.mockResolvedValue({ supervisionRetentionMs: 7 * 86_400_000 });
    const retention = useSupervisionRetention();
    await retention.load();

    expect(call).toHaveBeenCalledWith("/config/supervision");
    expect(retention.days.value).toBe(7);
    expect(retention.loaded.value).toBe(true);
  });

  it("writes the days back as milliseconds", async () => {
    const retention = useSupervisionRetention();
    retention.days.value = 90;
    await retention.save();

    expect(call).toHaveBeenCalledWith("/config/supervision", { method: "PUT", body: { supervisionRetentionMs: 90 * 86_400_000 } });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ color: "success" }));
  });

  it.each([
    ["under a day", RETENTION_MIN_DAYS - 1],
    ["over a year", RETENTION_MAX_DAYS + 1],
    ["a fraction of a day", 1.5],
  ])("refuses to send a retention %s", async (_case, value) => {
    const retention = useSupervisionRetention();
    retention.days.value = value;
    expect(retention.valid.value).toBe(false);

    await retention.save();
    expect(call).not.toHaveBeenCalled();
  });

  it("accepts both ends of the allowed range", () => {
    const retention = useSupervisionRetention();
    retention.days.value = RETENTION_MIN_DAYS;
    expect(retention.valid.value).toBe(true);
    retention.days.value = RETENTION_MAX_DAYS;
    expect(retention.valid.value).toBe(true);
  });

  // What the choice costs, said in rows rather than left to be discovered on a
  // disk: one row per ten seconds is 8 640 a day.
  it("says how many rows the chosen retention keeps", () => {
    const retention = useSupervisionRetention();
    retention.days.value = 30;
    expect(retention.rows.value).toBe(259_200);
    retention.days.value = 0;
    expect(retention.rows.value).toBe(0);
  });

  it("goes back to the month the recorder defaults to", () => {
    const retention = useSupervisionRetention();
    retention.days.value = 200;
    retention.resetDefaults();
    expect(retention.days.value).toBe(30);
  });

  it("says so and stops claiming to be loading when the read fails", async () => {
    call.mockRejectedValue(new Error("nope"));
    const retention = useSupervisionRetention();
    await retention.load();

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ color: "error" }));
    expect(retention.loaded.value).toBe(true);
  });

  it("says so and stops spinning when the write fails", async () => {
    const retention = useSupervisionRetention();
    call.mockRejectedValue(new Error("nope"));
    await retention.save();

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ color: "error" }));
    expect(retention.saving.value).toBe(false);
  });
});
