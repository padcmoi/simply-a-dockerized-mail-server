import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

const MB = 1024 * 1024;

export interface RecipientEditItem {
  id: number;
  email: string;
  quota: string;
  active: number;
}

// Quota/active from the recipients list -- gated by the classic single-resource
// ACL (recipients:access + recipients:modify for this domain), unlike the
// domains list's admin modal which needs "admin" AND "domain" together.
export function useRecipientEdit(domainId: Readonly<Ref<number | null>>, onSaved: () => Promise<void>) {
  const { call } = useApi();
  const toast = useToast();
  const { t } = useI18n();
  const auth = useAuthStore();
  const perms = usePermissionsStore();

  const editModalOpen = ref(false);
  const editModalItem = ref<RecipientEditItem | null>(null);
  const editSaving = ref(false);

  const canEditRecipients = computed(() => {
    if (!domainId.value) return false;
    return (
      auth.session?.isRoot === true ||
      (perms.hasDomain(domainId.value, "recipients", "access") && perms.hasDomain(domainId.value, "recipients", "modify"))
    );
  });

  function openEditModal(item: RecipientEditItem) {
    editModalItem.value = item;
    editModalOpen.value = true;
  }

  async function saveEdit(payload: { quotaMb: number; active: boolean }) {
    if (!editModalItem.value || !domainId.value) return;
    editSaving.value = true;
    try {
      await call(`/domains/${domainId.value}/recipients/${editModalItem.value.id}`, {
        method: "PATCH",
        body: { quota: payload.quotaMb * MB, active: payload.active },
      });
      editModalOpen.value = false;
      await onSaved();
      toast.add({ title: t("recipients.editModal.saved"), color: "success" });
    } catch (err) {
      toast.add({ title: t("recipients.editModal.saveFailed"), description: (err as Error).message, color: "error" });
    } finally {
      editSaving.value = false;
    }
  }

  return { editModalOpen, editModalItem, editSaving, canEditRecipients, openEditModal, saveEdit };
}
