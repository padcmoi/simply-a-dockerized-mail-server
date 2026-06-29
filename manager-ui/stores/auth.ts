import { defineStore } from "pinia";

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  username: string;
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
      return this.session ? { Authorization: `Bearer ${this.session.accessToken}` } : {};
    },
  },
  persist: true,
});
