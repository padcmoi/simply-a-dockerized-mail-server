import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

// useWindowFocus statically imports the domain store (bare `defineStore` at
// eval time) -- stub it before the dynamic import. The heavy onFocusGain path
// (auth.refresh + navigateTo + network) is driven by a real @vueuse focus ref
// we cannot deterministically flip here, so we cover the pure route-guard logic
// in `checkCurrentRoute`, which is the composable's own branching.
vi.stubGlobal("defineStore", defineStore);
vi.spyOn(console, "info").mockImplementation(() => {});
const { useWindowFocus } = await import("~/composables/useWindowFocus");
const { useDomainStore } = await import("~/stores/domain");

let showError: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  showError = vi.fn();
  vi.stubGlobal("showError", showError);
});

function login(isRoot: boolean) {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot };
}

describe("useWindowFocus.checkCurrentRoute", () => {
  it("blocks a rootOnly route for a non-root account", async () => {
    login(false);
    vi.stubGlobal("useRoute", () => ({ meta: { rootOnly: true } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
  });

  it("allows a rootOnly route for a root account", async () => {
    login(true);
    vi.stubGlobal("useRoute", () => ({ meta: { rootOnly: true } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).not.toHaveBeenCalled();
  });

  it("blocks when a required global permission is missing", async () => {
    login(false);
    vi.stubGlobal("useRoute", () => ({ meta: { requiredGlobal: [{ resource: "domains", action: "access" }] } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
  });

  it("allows when the required global permission is held", async () => {
    login(false);
    usePermissionsStore().data = { global: [{ resource: "domains", action: "access" }], domain: [] };
    vi.stubGlobal("useRoute", () => ({ meta: { requiredGlobal: [{ resource: "domains", action: "access" }] } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).not.toHaveBeenCalled();
  });

  it("blocks when a required domain permission is missing for the selected domain", async () => {
    login(false);
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    vi.stubGlobal("useRoute", () => ({ meta: { requiredDomain: [{ resource: "recipients", action: "access" }] } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
  });

  it("allows when the required domain permission is held", async () => {
    login(false);
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    usePermissionsStore().data = {
      global: [],
      domain: [{ domainId: 1, domainName: "example.com", resource: "recipients", action: "access" }],
    };
    vi.stubGlobal("useRoute", () => ({ meta: { requiredDomain: [{ resource: "recipients", action: "access" }] } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).not.toHaveBeenCalled();
  });

  it("skips the required-domain check when no domain is selected", async () => {
    login(false);
    vi.stubGlobal("useRoute", () => ({ meta: { requiredDomain: [{ resource: "recipients", action: "access" }] } }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).not.toHaveBeenCalled();
  });

  it("lets root bypass every global and domain requirement", async () => {
    login(true);
    useDomainStore().select({ id: 1, domain: "example.com", quota: "0", active: 1 });
    vi.stubGlobal("useRoute", () => ({
      meta: {
        requiredGlobal: [{ resource: "domains", action: "access" }],
        requiredDomain: [{ resource: "recipients", action: "access" }],
      },
    }));
    await useWindowFocus().checkCurrentRoute();
    expect(showError).not.toHaveBeenCalled();
  });
});
