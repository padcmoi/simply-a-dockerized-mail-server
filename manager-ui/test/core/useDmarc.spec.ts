import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

let call: ReturnType<typeof vi.fn>;
let toast: ReturnType<typeof vi.fn>;
let root: ReturnType<typeof ref<boolean>>;
let granted: Set<string>;

beforeEach(() => {
  call = vi.fn();
  toast = vi.fn();
  root = ref(false);
  granted = new Set();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useToast", () => ({ add: toast }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (e: unknown) => (e as Error).message }));
  vi.stubGlobal("usePermissions", () => ({
    isRoot: root,
    hasGlobal: (resource: string, action: string) => granted.has(`${resource}:${action}`),
  }));
});

const { useDmarcAccess, useDmarcActions, useDmarcFormat } = await import("~/composables/useDmarc");

describe("useDmarcAccess", () => {
  it("needs access and the action, and lets root through", () => {
    granted = new Set(["dmarc:view-dmarc-reports"]);
    expect(useDmarcAccess().canView.value).toBe(false);
    granted.add("dmarc:access");
    const access = useDmarcAccess();
    expect(access.canView.value).toBe(true);
    expect(access.canSend.value).toBe(false);
    root.value = true;
    expect(useDmarcAccess().canManage.value).toBe(true);
  });
});

describe("useDmarcActions", () => {
  it("sends yesterday's reports and says what went out", async () => {
    call.mockResolvedValue({ day: "2026-09-20", sent: 2, failed: 0, skipped: 1 });
    const actions = useDmarcActions();
    await expect(actions.run()).resolves.toMatchObject({ sent: 2 });
    expect(call).toHaveBeenCalledWith("/dmarc/outgoing/run", { method: "POST", body: {} });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ color: "success" }));
    expect(actions.busy.value).toBeNull();
  });

  it("says so when sending fails, and answers nothing", async () => {
    call.mockRejectedValue(new Error("boom"));
    await expect(useDmarcActions().run()).resolves.toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ color: "error", description: "boom" }));
  });

  it("reads the inboxes, and says so when it fails", async () => {
    call.mockResolvedValue({ scanned: 3, imported: 1 });
    await expect(useDmarcActions().scan()).resolves.toMatchObject({ imported: 1 });
    expect(call).toHaveBeenCalledWith("/dmarc/inbox/scan", { method: "POST" });
    call.mockRejectedValue(new Error("down"));
    await expect(useDmarcActions().scan()).resolves.toBeNull();
  });

  it("sends a report again, warning when it still did not go", async () => {
    call.mockResolvedValue({ id: 4, status: "sent" });
    await useDmarcActions().retry(4);
    expect(call).toHaveBeenCalledWith("/dmarc/outgoing/4/retry", { method: "POST" });
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ color: "success" }));

    call.mockResolvedValue({ id: 4, status: "failed" });
    await useDmarcActions().retry(4);
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ color: "warning" }));

    call.mockRejectedValue(new Error("nope"));
    await expect(useDmarcActions().retry(4)).resolves.toBeNull();
  });

  it("downloads the XML under the name the API gave it", async () => {
    const link = document.createElement("a");
    const click = vi.spyOn(link, "click").mockImplementation(() => undefined);
    vi.spyOn(document, "createElement").mockReturnValue(link);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:1"), revokeObjectURL: vi.fn() });
    call.mockResolvedValue({ filename: "r.xml", xml: "<feedback/>" });

    await useDmarcActions().download("incoming", 7);
    expect(call).toHaveBeenCalledWith("/dmarc/incoming/7/xml");
    expect(link.getAttribute("href")).toBe("blob:1");
    expect(link.download).toBe("r.xml");
    expect(click).toHaveBeenCalled();

    call.mockRejectedValue(new Error("gone"));
    await useDmarcActions().download("outgoing", 8);
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ color: "error" }));
    vi.restoreAllMocks();
  });
});

describe("useDmarcFormat", () => {
  it("writes a period as one day or a range, in UTC", () => {
    const { period } = useDmarcFormat();
    expect(period(1789862400, 1789948799)).toBe(period(1789862400, 1789862400));
    expect(period(1789862400, 1789948799 + 86_400)).toContain(" - ");
  });

  it("gives a rate to one decimal, nothing for an empty whole", () => {
    const { rate } = useDmarcFormat();
    expect(rate(17, 19)).toBe(89.5);
    expect(rate(0, 0)).toBeNull();
  });

  it("says never for a moment that did not happen, and formats counts", () => {
    const { when, count } = useDmarcFormat();
    expect(when(null)).toBe("dmarc.overview.never");
    expect(when(0)).not.toBe("dmarc.overview.never");
    expect(count(1234)).toBe((1234).toLocaleString("en-GB"));
  });
});
