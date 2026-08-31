import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

// useSessionRefresh reaches the domain store transitively (via useWindowFocus),
// so the bare `defineStore` must be stubbed before the dynamic import. We cover
// the returned `refresh` orchestration by spying the store actions it drives.
vi.stubGlobal("defineStore", defineStore);
vi.spyOn(console, "info").mockImplementation(() => {});
const { useSessionRefresh } = await import("~/composables/useSessionRefresh");

let navigate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  navigate = vi.fn();
  vi.stubGlobal("navigateTo", navigate);
  // useWindowFocus + useDataRefresh are bare auto-imports inside the composable;
  // the real checkCurrentRoute is exercised in useWindowFocus.spec.ts, so here
  // we only need an inert route-guard and refresh tick.
  vi.stubGlobal("useWindowFocus", () => ({ checkCurrentRoute: vi.fn(), focused: ref(false) }));
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
});

function authenticate() {
  useAuthStore().session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io", isRoot: true };
}

describe("useSessionRefresh.refresh", () => {
  it("no-ops entirely when unauthenticated", async () => {
    const auth = useAuthStore();
    const refreshSpy = vi.spyOn(auth, "refresh");
    const { refresh } = useSessionRefresh();
    await refresh();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("re-fetches profile and permissions on a successful token refresh", async () => {
    authenticate();
    const auth = useAuthStore();
    const perms = usePermissionsStore();
    vi.spyOn(auth, "refresh").mockResolvedValue(true);
    const profileSpy = vi.spyOn(auth, "fetchProfile").mockResolvedValue(undefined);
    const permsSpy = vi.spyOn(perms, "fetch").mockResolvedValue(undefined);

    const { refresh } = useSessionRefresh();
    await refresh();

    expect(profileSpy).toHaveBeenCalledTimes(1);
    expect(permsSpy).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects to /login when the token refresh fails", async () => {
    authenticate();
    const auth = useAuthStore();
    vi.spyOn(auth, "refresh").mockResolvedValue(false);
    const profileSpy = vi.spyOn(auth, "fetchProfile").mockResolvedValue(undefined);

    const { refresh } = useSessionRefresh();
    await refresh();

    expect(navigate).toHaveBeenCalledWith("/login");
    expect(profileSpy).not.toHaveBeenCalled();
  });
});
