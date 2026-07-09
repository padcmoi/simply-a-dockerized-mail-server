import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";
import { usePermissionsStore } from "~/stores/permissions";

const MB = 1024 * 1024;

export interface DomainAdminItem {
  id: number;
  domain: string;
  quota: string;
  active: number;
}

// Rename/quota/delete from the domains list -- gated more strictly than the
// rest of the Administration surface (see admin-domains.controller.ts):
// root or the global "superadmin" resource's own "access" action only.
// Deliberately NOT domain-tier: a domain owner (even a "domain root") never
// qualifies, no matter what domain-tier grants they hold.
export function useDomainAdmin(onSaved: () => Promise<void>) {
  const { call } = useApi();
  const toast = useToast();
  const { t } = useI18n();
  const auth = useAuthStore();
  const perms = usePermissionsStore();
  const domainStore = useDomainStore();

  const adminModalOpen = ref(false);
  const adminModalItem = ref<DomainAdminItem | null>(null);
  const adminSaving = ref(false);

  function canAdminister() {
    return auth.session?.isRoot === true || perms.hasGlobal("superadmin", "access");
  }

  function canDeleteDomain() {
    return auth.session?.isRoot === true || perms.hasGlobal("superadmin", "access");
  }

  function openAdminModal(item: DomainAdminItem) {
    adminModalItem.value = item;
    adminModalOpen.value = true;
  }

  // 3 single-purpose admin routes now (rename / quota / delete, see
  // admin-domains.controller.ts) -- only call the ones whose field actually
  // changed. `active` isn't part of this admin surface at all anymore: it's
  // legitimate owner self-service, handled entirely by the dedicated
  // PATCH /domains/:domainId/active route elsewhere.
  async function saveAdmin(payload: { domain: string; quotaMb: number }) {
    if (!adminModalItem.value) return;
    const id = adminModalItem.value.id;
    const quotaBytes = payload.quotaMb * MB;
    adminSaving.value = true;
    try {
      if (payload.domain !== adminModalItem.value.domain) {
        await call(`/admin/domains/${id}/rename`, { method: "PATCH", body: { domain: payload.domain } });
      }
      if (String(quotaBytes) !== adminModalItem.value.quota) {
        await call(`/admin/domains/${id}/quota`, { method: "PATCH", body: { quota: quotaBytes } });
      }
      adminModalOpen.value = false;
      await onSaved();
      toast.add({ title: t("domains.adminModal.saved"), color: "success" });
    } catch (err) {
      toast.add({ title: t("domains.adminModal.saveFailed"), description: (err as Error).message, color: "error" });
    } finally {
      adminSaving.value = false;
    }
  }

  async function deleteFromAdminModal() {
    if (!adminModalItem.value) return;
    const id = adminModalItem.value.id;
    try {
      await call(`/admin/domains/${id}`, { method: "DELETE" });
      if (domainStore.selected?.id === id) domainStore.clear();
      adminModalOpen.value = false;
      await onSaved();
      toast.add({ title: t("domains.adminModal.deleted"), color: "success" });
    } catch (err) {
      toast.add({ title: t("domains.adminModal.deleteFailed"), description: (err as Error).message, color: "error" });
    }
  }

  return {
    adminModalOpen,
    adminModalItem,
    adminSaving,
    canAdminister,
    canDeleteDomain,
    openAdminModal,
    saveAdmin,
    deleteFromAdminModal,
  };
}
