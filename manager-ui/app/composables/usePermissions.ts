import { usePermissionsStore } from "~/stores/permissions";
import { useAuthStore } from "~/stores/auth";

export function usePermissions() {
  const store = usePermissionsStore();
  const auth = useAuthStore();
  return {
    permissions: computed(() => store.data),
    isRoot: computed(() => auth.session?.isRoot ?? false),
    hasGlobal: (resource: string, action: string) => store.hasGlobal(resource, action),
    hasDomain: (domainId: number, resource: string, action: string) => store.hasDomain(domainId, resource, action),
  };
}
