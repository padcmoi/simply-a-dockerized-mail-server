import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAdminAlertConfig } from "~/composables/useAdminAlertConfig";

let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn(async (_path: string, options?: { body?: { adminAlertEmail: string } }) => ({
    adminAlertEmail: options?.body ? options.body.adminAlertEmail : "admin@example.com",
  }));
  add = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (err: unknown) => String(err) }));
  vi.stubGlobal("useToast", () => ({ add }));
});

describe("useAdminAlertConfig", () => {
  it("loads the stored address, with nothing to save until it changes", async () => {
    const { form, valid, loaded, load } = useAdminAlertConfig();
    await load();
    expect(call).toHaveBeenCalledWith("/config/alert");
    expect(loaded.value).toBe(true);
    expect(form.adminAlertEmail).toBe("admin@example.com");
    expect(valid.value).toBe(false);
  });

  it("refuses an invalid address and accepts an empty one", async () => {
    const { form, valid, emailError, load } = useAdminAlertConfig();
    await load();
    for (const bad of ["admin", "admin@", "admin@example", "a@b.com, c@d.com", "a b@c.com"]) {
      form.adminAlertEmail = bad;
      expect(emailError.value, bad).toBe("config.adminAlert.emailInvalid");
      expect(valid.value, bad).toBe(false);
    }
    form.adminAlertEmail = "";
    expect(emailError.value).toBeUndefined();
    expect(valid.value).toBe(true);
  });

  it("saves the address trimmed and in lower case, then has nothing left to save", async () => {
    const { form, valid, load, save } = useAdminAlertConfig();
    await load();
    form.adminAlertEmail = "  Ops@Example.COM ";
    expect(valid.value).toBe(true);
    await save();
    expect(call).toHaveBeenLastCalledWith("/config/alert", { method: "PUT", body: { adminAlertEmail: "ops@example.com" } });
    expect(form.adminAlertEmail).toBe("ops@example.com");
    expect(valid.value).toBe(false);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "config.adminAlert.saved", color: "success" }));
  });

  it("says the address was removed when it is saved empty", async () => {
    const { form, load, save } = useAdminAlertConfig();
    await load();
    form.adminAlertEmail = "";
    await save();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "config.adminAlert.cleared" }));
  });

  it("keeps what was typed and reports the error when the save fails", async () => {
    const { form, valid, load, save } = useAdminAlertConfig();
    await load();
    call.mockRejectedValueOnce(new Error("boom"));
    form.adminAlertEmail = "ops@example.com";
    await save();
    expect(form.adminAlertEmail).toBe("ops@example.com");
    expect(valid.value).toBe(true);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "config.adminAlert.saveFailed", color: "error" }));
  });

  it("shows the form even when the load fails", async () => {
    call.mockRejectedValueOnce(new Error("down"));
    const { loaded, load } = useAdminAlertConfig();
    await load();
    expect(loaded.value).toBe(true);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "config.adminAlert.loadFailed" }));
  });
});
