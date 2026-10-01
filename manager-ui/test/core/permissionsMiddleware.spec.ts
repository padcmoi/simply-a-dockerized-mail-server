import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteLocationNormalized } from "vue-router";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

vi.stubGlobal("defineStore", defineStore);

type AfterEach = (to: unknown, from: unknown, failure?: unknown) => void;
type Page = { meta: Record<string, unknown> };

const guard = (await import("~/middleware/permissions.global")).default;

async function middleware(page: Page) {
  const to = page as RouteLocationNormalized;
  await guard(to, to);
}

let showError: ReturnType<typeof vi.fn>;
let hooks: AfterEach[];
let hydrating: boolean;

const accountsPage = {
  meta: {
    requiredGlobal: [
      { resource: "accounts", action: "access" },
      { resource: "accounts", action: "list-accounts" },
    ],
  },
};

function signIn(isRoot: boolean, global: { resource: string; action: string }[]) {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot };
  const perms = usePermissionsStore();
  perms.data = { global, domain: [] };
  perms.loaded = true;
}

beforeEach(() => {
  setActivePinia(createPinia());
  showError = vi.fn();
  hooks = [];
  hydrating = false;
  vi.stubGlobal("showError", showError);
  vi.stubGlobal("useNuxtApp", () => ({ isHydrating: hydrating }));
  vi.stubGlobal("useRouter", () => ({
    afterEach: (hook: AfterEach) => {
      hooks.push(hook);
      return () => {
        hooks = hooks.filter((h) => h !== hook);
      };
    },
  }));
});

describe("permissions middleware", () => {
  it("lets an account holding every required action through", async () => {
    signIn(false, [
      { resource: "accounts", action: "access" },
      { resource: "accounts", action: "list-accounts" },
    ]);
    await middleware(accountsPage);
    expect(hooks).toHaveLength(0);
    expect(showError).not.toHaveBeenCalled();
  });

  it("lets a root account through whatever the page asks", async () => {
    signIn(true, []);
    await middleware({ meta: { rootOnly: true, ...accountsPage.meta } });
    expect(hooks).toHaveLength(0);
    expect(showError).not.toHaveBeenCalled();
  });

  it("raises the 403 once the navigation has ended, where the router would have cleared it", async () => {
    signIn(false, [
      { resource: "accounts", action: "access" },
      { resource: "accounts", action: "list-account-names" },
    ]);
    await middleware(accountsPage);
    expect(showError).not.toHaveBeenCalled();
    expect(hooks).toHaveLength(1);
    hooks[0]?.({}, {});
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
    expect(hooks).toHaveLength(0);
  });

  it("raises nothing when the navigation itself failed", async () => {
    signIn(false, []);
    await middleware(accountsPage);
    hooks[0]?.({}, {}, new Error("aborted"));
    expect(showError).not.toHaveBeenCalled();
    expect(hooks).toHaveLength(0);
  });

  it("raises the 403 at once on the first load of a page", async () => {
    hydrating = true;
    signIn(false, []);
    await middleware(accountsPage);
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
    expect(hooks).toHaveLength(0);
  });

  it("refuses a root only page to any other account", async () => {
    signIn(false, [{ resource: "accounts", action: "access" }]);
    await middleware({ meta: { rootOnly: true } });
    hooks[0]?.({}, {});
    expect(showError).toHaveBeenCalledWith({ statusCode: 403 });
  });
});
