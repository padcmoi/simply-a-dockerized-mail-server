import { defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";

interface GlobalPermission {
  resource: string;
  action: string;
}

interface DomainPermission {
  domainId: number;
  resource: string;
  action: string;
}

interface PermissionsData {
  global: GlobalPermission[];
  domain: DomainPermission[];
}

export const usePermissionsStore = defineStore("permissions", {
  // `loaded` tracks whether a fetch has completed at least once for the current
  // session; see `app/middleware/permissions.global.ts`, which uses it to force
  // a fresh lookup on first navigation instead of trusting a stale/empty state.
  state: () => ({ data: { global: [], domain: [] } as PermissionsData, loaded: false }),
  actions: {
    hasGlobal(resource: string, action: string) {
      return this.data.global.some((p) => p.resource === resource && p.action === action);
    },
    hasDomain(domainId: number, resource: string, action: string) {
      return this.data.domain.some((p) => p.domainId === domainId && p.resource === resource && p.action === action);
    },
    async fetch() {
      const auth = useAuthStore();
      if (!auth.session) return;
      try {
        this.data = await $fetch<PermissionsData>("/api/v1/auth/jwt/me/permissions", {
          headers: auth.authHeaders(),
        });
      } catch {
        this.data = { global: [], domain: [] };
      } finally {
        this.loaded = true;
      }
    },
  },
});
