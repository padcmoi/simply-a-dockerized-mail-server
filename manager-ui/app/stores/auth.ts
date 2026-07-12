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
      if (!this.session) return false;
      try {
        const data = await $fetch<{
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
        }>("/api/v1/auth/jwt/refresh", {
          method: "POST",
          body: { refreshToken: this.session.refreshToken },
        });
        this.session = { ...this.session, ...data };
        return true;
      } catch {
        this.session = null;
        return false;
      }
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
