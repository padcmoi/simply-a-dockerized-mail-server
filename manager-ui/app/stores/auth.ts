import { defineStore } from "pinia";

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  // Email is the login identity now; displayName is the friendly label (from the
  // profile) shown in the sidebar, falling back to the email when unset.
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isRoot?: boolean;
  groups?: { id: string; name: string }[];
}

// The subset of GET /auth/jwt/me the store keeps in the session (the endpoint
// also returns phone/address/geo, consumed only by the profile page).
interface Profile {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isRoot: boolean;
  groups: { id: string; name: string }[];
}

// PATCH /auth/jwt/me payload: the login email plus every editable profile field.
export interface UpdateProfileInput {
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  addressComplement?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

// Single-flight guard for token refresh (client-only). The refresh token rotates
// in place (single-use), so when several triggers -- the useApi 401 retry, window
// focus, the visibility change, the focus heartbeat -- call refresh() at once, the
// first rotates the token and the rest POST an already-rotated one, get a 401 and
// log the user out. Sharing one in-flight promise makes them all await the same
// rotation. refresh() only ever runs on the client, so a module-level var is safe.
let refreshInFlight: Promise<boolean> | null = null;

// Proactive, focus-driven refresh must NOT rotate a still-valid access token.
// Because the refresh token is single-use (rotates in place), rotating it on every
// window focus / tab visibility gain -- while the access token is still valid --
// raced with page reloads: an F5 landing between the server rotating the token and
// the store persisting the new one replayed a just-consumed token and logged the
// user out. So focus/visibility only rotate when the access token is actually near
// expiry; the 401 retry in useApi stays the backstop for one that expired unseen.
// TTL is 15 min, so a 2 min buffer keeps a comfortable margin.
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 120_000;

export const useAuthStore = defineStore("auth", {
  state: () => ({ session: null as Session | null }),
  getters: { isAuthenticated: (state) => state.session !== null },
  actions: {
    async login(email: string, password: string) {
      const data = await $fetch<{
        accessToken: string;
        refreshToken: string;
        expiresAt: string;
      }>("/api/v1/auth/jwt/login", {
        method: "POST",
        body: { email, password },
      });
      this.session = { ...data, email };
      await this.fetchProfile().catch(() => undefined);
    },
    async fetchProfile() {
      if (!this.session) return;
      const me = await $fetch<Profile>("/api/v1/auth/jwt/me", {
        headers: this.authHeaders(),
      });
      this.session = {
        ...this.session,
        email: me.email,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        isRoot: me.isRoot,
        groups: me.groups,
      };
    },
    async updateProfile(input: UpdateProfileInput) {
      if (!this.session) return;
      const me = await $fetch<Profile>("/api/v1/auth/jwt/me", {
        method: "PATCH",
        body: input,
        headers: this.authHeaders(),
      });
      this.session = {
        ...this.session,
        email: me.email,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        isRoot: me.isRoot,
        groups: me.groups,
      };
    },
    async logout() {
      if (this.session) {
        await $fetch("/api/v1/auth/jwt/logout", {
          method: "POST",
          body: { refreshToken: this.session.refreshToken },
          headers: { Authorization: `Bearer ${this.session.accessToken}` },
        }).catch(() => undefined);
      }
      this.session = null;
      // Fraîcheur des droits: never let a subsequent login (without a hard reload)
      // inherit the previous account's cached permissions.
      usePermissionsStore().$reset();
    },
    async refresh() {
      const current = this.session;
      if (!current) return false;
      // Coalesce concurrent callers onto one in-flight /refresh (see refreshInFlight).
      if (refreshInFlight) return refreshInFlight;
      refreshInFlight = (async () => {
        try {
          const data = await $fetch<{
            accessToken: string;
            refreshToken: string;
            expiresAt: string;
          }>("/api/v1/auth/jwt/refresh", {
            method: "POST",
            body: { refreshToken: current.refreshToken },
          });
          this.session = { ...(this.session ?? current), ...data };
          return true;
        } catch {
          this.session = null;
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },
    // True when the access token is missing its expiry or is within the buffer of
    // expiring. Focus/visibility handlers gate their rotation on this so a token
    // with plenty of life left is left untouched (see ACCESS_TOKEN_REFRESH_BUFFER_MS).
    accessTokenExpiresSoon() {
      if (!this.session) return false;
      const expiresAt = Date.parse(this.session.expiresAt);
      if (Number.isNaN(expiresAt)) return true;
      return expiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_BUFFER_MS;
    },
    // Focus/visibility entry point: rotate only when the access token is near
    // expiry, otherwise report success without touching the single-use refresh
    // token. Returns false only when there is no session at all.
    async refreshIfNeeded() {
      if (!this.session) return false;
      if (!this.accessTokenExpiresSoon()) return true;
      return this.refresh();
    },
    authHeaders() {
      // Always return a `Record<string, string>`-typed object so $fetch's
      // HeadersInit constraint is satisfied without an explicit return type
      // annotation (banned by the gestlok no-restricted-syntax rule).
      const headers: Record<string, string> = {};
      if (this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
      return headers;
    },
  },
  persist: true,
});
