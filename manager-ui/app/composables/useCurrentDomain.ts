import { useDomainStore } from "~/stores/domain";

// Resolves the domain scoping recipients/aliases/quotas pages from the
// route's `:domain` slug, syncing `useDomainStore` the same way
// `useDomainDashboard.ts` already does for the dashboard itself. Needed
// because these pages no longer rely on the store having been pre-filled
// by a prior click through /domains -- a direct deep link/hard reload must
// resolve on its own.
export function useCurrentDomain() {
  const route = useRoute();
  const { call } = useApi();
  const domainStore = useDomainStore();
  const domainFqdn = computed(() => String(route.params.domain));

  // Static, shared key on purpose: recipients/aliases/quotas are never
  // mounted at the same time, so switching between them for the *same*
  // domain reuses this result instead of re-fetching `/domains`. A real
  // slug change (`watch: [domainFqdn]`) still triggers a fresh resolve --
  // unlike `domain-dashboard-main`, which has no such watch and therefore
  // won't notice a `:domain` param change on an instance Vue Router reuses.
  useAsyncData<null>(
    "current-domain-resolve",
    async () => {
      if (domainStore.selected?.domain === domainFqdn.value) return null;
      const domains = await call<{ id: number; domain: string; quota: string; active: number }[]>("/domains");
      const found = domains.find((d) => d.domain === domainFqdn.value) ?? null;
      if (found) domainStore.select(found);
      return null;
    },
    { server: false, watch: [domainFqdn] }
  );

  // Guards against a stale *different* domain still sitting in the
  // (persisted) store while resolution for the current slug is in flight.
  const domainId = computed(() =>
    domainStore.selected?.domain === domainFqdn.value ? (domainStore.selected?.id ?? null) : null
  );

  return { domainId, domainFqdn };
}
