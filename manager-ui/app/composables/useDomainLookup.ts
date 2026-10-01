import { useDomainStore } from "~/stores/domain";
import { usePermissionsStore } from "~/stores/permissions";

export function useDomainLookup() {
  const { call } = useApi();
  const { isRoot, hasGlobal } = usePermissions();
  const perms = usePermissionsStore();
  const domainStore = useDomainStore();

  async function findDomain<T extends { id: number; domain: string }>(fqdn: string) {
    if (isRoot.value || hasGlobal("domains", "access")) {
      const domains = await call<T[]>("/domains");
      return domains.find((d) => d.domain === fqdn) ?? null;
    }
    const id =
      perms.data.domain.find((p) => p.domainName === fqdn)?.domainId ??
      (domainStore.selected?.domain === fqdn ? domainStore.selected.id : null);
    if (id === null || id === undefined) return null;
    const found = await call<T>(`/domains/${id}`).catch(() => null);
    return found && found.domain === fqdn ? found : null;
  }

  return { findDomain };
}
