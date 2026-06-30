import { defineStore } from "pinia";

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  username: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  isRoot?: boolean;
}

interface Profile {
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isRoot: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({ session: null as Session | null }),
  getters: { isAuthenticated: (state) => state.session !== null },
  actions: {
    async login(username: string, password: string) {
      const data = await $fetch<{ accessToken: string; refreshToken: string; expiresAt: string }>("/api/v1/auth/jwt/login", {
        method: "POST",
        body: { username, password },
      });
      this.session = { ...data, username };
      await this.fetchProfile().catch(() => undefined);
    },
    async fetchProfile() {
      if (!this.session) return;
      const me = await $fetch<Profile>("/api/v1/auth/jwt/me", {
        headers: this.authHeaders(),
      });
      this.session = {
        ...this.session,
        username: me.username,
        name: me.name,
        email: me.email,
        avatarUrl: me.avatarUrl,
        isRoot: me.isRoot,
      };
    },
    async updateProfile(input: { name?: string | null; email?: string | null; avatarUrl?: string | null }) {
      if (!this.session) return;
      const me = await $fetch<Profile>("/api/v1/auth/jwt/me", {
        method: "PATCH",
        body: input,
        headers: this.authHeaders(),
      });
      this.session = {
        ...this.session,
        username: me.username,
        name: me.name,
        email: me.email,
        avatarUrl: me.avatarUrl,
        isRoot: me.isRoot,
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
