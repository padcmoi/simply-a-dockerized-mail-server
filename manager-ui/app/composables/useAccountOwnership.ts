import type { Ref } from "vue";

// Drives one account's ownership of a single kind (recipients or aliases):
// the resources it owns, the unassigned ones it may attach (optionally filtered
// to a domain), and the attach/detach calls. The account side manages ownership
// globally; the backend gates it on accounts:assign/unassign-*-owner.
export function useAccountOwnership(accountId: Ref<string>, kind: "recipients" | "aliases") {
  const { call } = useApi();

  const owned = ref<OwnedResource[]>([]);
  const assignable = ref<OwnedResource[]>([]);
  const domains = ref<{ id: number; domain: string }[]>([]);
  const domainId = ref<number | undefined>(undefined);
  const loading = ref(false);

  const base = () => `/accounts/${accountId.value}/${kind}`;

  async function loadOwned() {
    owned.value = await call<OwnedResource[]>(base());
  }

  async function loadAssignable() {
    const query = domainId.value !== undefined ? `?domainId=${domainId.value}` : "";
    const res = await call<AssignableResponse>(`${base()}/assignable${query}`);
    domains.value = res.domains;
    assignable.value = res.items;
  }

  async function load() {
    loading.value = true;
    try {
      await Promise.all([loadOwned(), loadAssignable()]);
    } finally {
      loading.value = false;
    }
  }

  async function attach(itemId: number) {
    await call(`${base()}/${itemId}`, { method: "POST" });
    await load();
  }

  async function detach(itemId: number) {
    await call(`${base()}/${itemId}`, { method: "DELETE" });
    await load();
  }

  watch(domainId, loadAssignable);

  return { owned, assignable, domains, domainId, loading, load, attach, detach };
}
