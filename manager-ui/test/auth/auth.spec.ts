import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "~/stores/auth";

// logout calls the permissions store via a bare Nuxt auto-import
// (`usePermissionsStore().$reset()`), so expose a spyable stub for it.
let resetSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  resetSpy = vi.fn();
  vi.stubGlobal("usePermissionsStore", () => ({ $reset: resetSpy }));
});

// Routes every $fetch call by URL so login (tokens) + fetchProfile (me) can be
// driven from one mock. `me` may be told to throw to hit the swallow path.
function stubFetch(opts: { me?: unknown; meThrows?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/login")) return { accessToken: "at", refreshToken: "rt", expiresAt: "2030-01-01" };
    if (url.includes("/refresh")) return { accessToken: "at2", refreshToken: "rt2", expiresAt: "2031-01-01" };
    if (url.includes("/me")) {
      if (opts.meThrows) throw new Error("me failed");
      return (
        opts.me ?? {
          email: "profile@example.com",
          displayName: "Profile Name",
          avatarUrl: "http://x/a.png",
          isRoot: true,
          groups: [{ id: "g1", name: "Admins" }],
        }
      );
    }
    return {};
  });
  vi.stubGlobal("$fetch", fetchMock);
  return fetchMock;
}

describe("auth store state + getters", () => {
  it("starts with no session and is not authenticated", () => {
    const auth = useAuthStore();
    expect(auth.session).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it("authHeaders is empty without a session and carries the bearer token with one", () => {
    const auth = useAuthStore();
    expect(auth.authHeaders()).toEqual({});
    auth.session = {
      accessToken: "abc",
      refreshToken: "r",
      expiresAt: "x",
      email: "e@x.io",
    };
    expect(auth.authHeaders()).toEqual({ Authorization: "Bearer abc" });
    expect(auth.isAuthenticated).toBe(true);
  });
});

describe("auth store login", () => {
  it("stores the tokens then overwrites identity fields from the profile", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    await auth.login("login@example.com", "secret");

    expect(auth.session?.accessToken).toBe("at");
    expect(auth.session?.refreshToken).toBe("rt");
    // fetchProfile ran and replaced the login email with the profile one.
    expect(auth.session?.email).toBe("profile@example.com");
    expect(auth.session?.displayName).toBe("Profile Name");
    expect(auth.session?.isRoot).toBe(true);
    expect(auth.session?.groups).toEqual([{ id: "g1", name: "Admins" }]);

    // The login body carried the typed email + password.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/jwt/login",
      expect.objectContaining({ method: "POST", body: { email: "login@example.com", password: "secret" } })
    );
  });

  it("keeps the session on the login email when the profile fetch fails", async () => {
    stubFetch({ meThrows: true });
    const auth = useAuthStore();
    await auth.login("login@example.com", "secret");

    expect(auth.session?.accessToken).toBe("at");
    expect(auth.session?.email).toBe("login@example.com");
    expect(auth.session?.displayName).toBeUndefined();
  });
});

describe("auth store fetchProfile + updateProfile", () => {
  it("fetchProfile is a no-op without a session", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    await auth.fetchProfile();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.session).toBeNull();
  });

  it("fetchProfile merges the profile fields into the existing session", async () => {
    stubFetch({ me: { email: "new@x.io", displayName: "New", avatarUrl: null, isRoot: false, groups: [] } });
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "old@x.io" };
    await auth.fetchProfile();
    expect(auth.session?.email).toBe("new@x.io");
    expect(auth.session?.displayName).toBe("New");
    expect(auth.session?.isRoot).toBe(false);
    // Tokens are preserved across the merge.
    expect(auth.session?.accessToken).toBe("at");
  });

  it("updateProfile is a no-op without a session", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    await auth.updateProfile({ displayName: "Nope" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updateProfile PATCHes and merges the returned profile", async () => {
    const fetchMock = stubFetch({
      me: { email: "e@x.io", displayName: "Renamed", avatarUrl: null, isRoot: false, groups: [] },
    });
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io" };
    await auth.updateProfile({ displayName: "Renamed" });
    expect(auth.session?.displayName).toBe("Renamed");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/jwt/me",
      expect.objectContaining({ method: "PATCH", body: { displayName: "Renamed" } })
    );
  });
});

describe("auth store logout", () => {
  it("hits the logout endpoint, clears the session and resets permissions", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io" };
    await auth.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/jwt/logout",
      expect.objectContaining({ method: "POST", body: { refreshToken: "rt" } })
    );
    expect(auth.session).toBeNull();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("still resets permissions but skips the endpoint when there is no session", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    await auth.logout();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.session).toBeNull();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});

describe("auth store refresh", () => {
  it("returns false and does nothing without a session", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    expect(await auth.refresh()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("merges the rotated tokens and returns true on success", async () => {
    stubFetch();
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io" };
    expect(await auth.refresh()).toBe(true);
    expect(auth.session?.accessToken).toBe("at2");
    expect(auth.session?.refreshToken).toBe("rt2");
    // Identity fields survive a token-only refresh.
    expect(auth.session?.email).toBe("e@x.io");
  });

  it("clears the session and returns false when the refresh call throws", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn(async () => {
        throw new Error("expired");
      })
    );
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "e@x.io" };
    expect(await auth.refresh()).toBe(false);
    expect(auth.session).toBeNull();
  });
});

describe("auth store refreshIfNeeded", () => {
  it("returns false and never fetches without a session", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    expect(await auth.refreshIfNeeded()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves a still-valid access token untouched (no rotation, no fetch)", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    // Expiry far in the future -> well outside the refresh buffer.
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "2099-01-01", email: "e@x.io" };
    expect(await auth.refreshIfNeeded()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.session?.accessToken).toBe("at");
    expect(auth.session?.refreshToken).toBe("rt");
  });

  it("rotates when the access token is already expired", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "2000-01-01", email: "e@x.io" };
    expect(await auth.refreshIfNeeded()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/jwt/refresh", expect.objectContaining({ method: "POST" }));
    expect(auth.session?.accessToken).toBe("at2");
  });

  it("rotates when the expiry is unparseable (fails safe)", async () => {
    const fetchMock = stubFetch();
    const auth = useAuthStore();
    auth.session = { accessToken: "at", refreshToken: "rt", expiresAt: "not-a-date", email: "e@x.io" };
    expect(await auth.refreshIfNeeded()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/jwt/refresh", expect.objectContaining({ method: "POST" }));
  });
});
