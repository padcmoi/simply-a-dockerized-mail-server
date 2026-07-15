import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePermissionsStore } from "~/stores/permissions";
import { useAuthStore } from "~/stores/auth";

beforeEach(() => {
  setActivePinia(createPinia());
});

// Give the auth store a session so authHeaders() is populated and the store's
// `if (!auth.session) return` guard is passed.
function authenticate() {
  const auth = useAuthStore();
  auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io" };
  return auth;
}

describe("permissions store getters", () => {
  it("starts empty and unloaded", () => {
    const perms = usePermissionsStore();
    expect(perms.data).toEqual({ global: [], domain: [] });
    expect(perms.loaded).toBe(false);
  });

  it("hasGlobal matches on resource + action", () => {
    const perms = usePermissionsStore();
    perms.data = { global: [{ resource: "domains", action: "access" }], domain: [] };
    expect(perms.hasGlobal("domains", "access")).toBe(true);
    expect(perms.hasGlobal("domains", "create")).toBe(false);
    expect(perms.hasGlobal("rspamd", "access")).toBe(false);
  });

  it("hasDomain matches on domainId + resource + action", () => {
    const perms = usePermissionsStore();
    perms.data = {
      global: [],
      domain: [{ domainId: 7, domainName: "x.io", resource: "recipients", action: "access" }],
    };
    expect(perms.hasDomain(7, "recipients", "access")).toBe(true);
    expect(perms.hasDomain(7, "recipients", "modify")).toBe(false);
    expect(perms.hasDomain(9, "recipients", "access")).toBe(false);
  });
});

describe("permissions store fetch", () => {
  it("does nothing and stays unloaded without an auth session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("$fetch", fetchMock);
    const perms = usePermissionsStore();
    await perms.fetch();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(perms.loaded).toBe(false);
  });

  it("loads the payload and flips loaded true on success", async () => {
    authenticate();
    const payload = {
      global: [{ resource: "domains", action: "access" }],
      domain: [{ domainId: 1, domainName: "a.io", resource: "recipients", action: "access" }],
    };
    const fetchMock = vi.fn(async () => payload);
    vi.stubGlobal("$fetch", fetchMock);
    const perms = usePermissionsStore();
    await perms.fetch();
    expect(perms.data).toEqual(payload);
    expect(perms.loaded).toBe(true);
    // Authorization header from the auth store was forwarded.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/jwt/me/permissions",
      expect.objectContaining({ headers: { Authorization: "Bearer at" } })
    );
  });

  it("resets to empty but still marks loaded when the fetch throws", async () => {
    authenticate();
    vi.stubGlobal(
      "$fetch",
      vi.fn(async () => {
        throw new Error("boom");
      })
    );
    const perms = usePermissionsStore();
    perms.data = { global: [{ resource: "x", action: "y" }], domain: [] };
    await perms.fetch();
    expect(perms.data).toEqual({ global: [], domain: [] });
    expect(perms.loaded).toBe(true);
  });
});
