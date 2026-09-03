import { MB } from "~/utils/bytes";

// What the mail volume still has to hand out to a new domain. Shared by the
// domains list (capacity card) and the create page (quota ceiling + donut).
//
// `GET /domains/disk` demands `domains:view-disk-usage`, a separate grant from
// the `domains:create-domain` needed to add one. An account holding the latter
// without the former therefore gets `null` here rather than a fabricated zero:
// no ceiling is shown, no value is refused client-side, and the API stays the
// authority.
export function useDomainDisk() {
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const { t } = useI18n();

  const disk = ref<DomainDisk | null>(null);
  const diskLoading = ref(false);

  const assignableMb = computed(() => (disk.value ? Math.floor(disk.value.assignableBytes / MB) : null));

  async function loadDisk() {
    diskLoading.value = true;
    try {
      disk.value = await call<DomainDisk>("/domains/disk");
    } catch (err) {
      toast.add({ title: t("domains.toast.loadFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      diskLoading.value = false;
    }
  }

  const realtimeDisk = useRealtimeTopic<DomainDisk>("domains-disk");
  watch(realtimeDisk, (v) => {
    if (v) disk.value = v;
  });

  return { disk, diskLoading, assignableMb, loadDisk };
}
