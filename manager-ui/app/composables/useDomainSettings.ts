// The domain administration panel: the domain row itself, its DKIM keys and
// their check, the active toggle, and the ownership transfer. The page that
// shows the accordion was carrying all of this.

export function useDomainSettings(domainFqdn: () => string) {
  const { t } = useI18n();
  const { call } = useApi();
  const toast = useToast();
  const auth = useAuthStore();
  const { isRoot } = usePermissions();

  // Ownership transfer authorization is decided entirely server-side (root or
  // current owner, see domains.controller.ts's transferOwner) -- the section
  // always renders and the PATCH call is what actually enforces it (403 caught
  // below). `isOwnerOrRoot` only disables the button as a UX hint so an
  // obviously-doomed request isn't submitted; it grants nothing by itself.
  const ownerPick = ref<string | undefined>(undefined);
  const savingOwner = ref(false);
  const savingActive = ref(false);
  const accountOptions = ref<{ label: string; value: string }[]>([]);
  // Starts true: still don't know `domain.id` at first paint (SSR + pre-mount),
  // so the select must show a skeleton immediately rather than an empty
  // dropdown before we've even determined whether a fetch is needed.
  const ownerOptionsLoading = ref(true);

  const { data: domainData, refresh: refreshDomain } = useAsyncData<Domain | null>(
    "domain-admin-info",
    async () => {
      const domains = await call<Domain[]>("/domains");
      return domains.find((d) => d.domain === domainFqdn()) ?? null;
    },
    { server: false, watch: [domainFqdn], default: () => null }
  );
  const domain = computed(() => domainData.value);
  const domainId = computed(() => domain.value?.id ?? null);

  // `immediate: false`: only makes sense once `domainId` is known -- see the
  // same pattern (and its rationale) in useDomainDashboard.ts.
  const {
    data: dkimData,
    status: dkimStatus,
    refresh: refreshDkim,
  } = useAsyncData<DkimKey[]>(
    "domain-admin-dkim",
    async () => {
      if (!domainId.value) return [];
      try {
        return await call<DkimKey[]>(`/domains/${domainId.value}/dkim`);
      } catch {
        return [];
      }
    },
    { server: false, immediate: false, watch: [domainId], default: () => [] }
  );
  const dkimKeys = computed(() => dkimData.value ?? []);
  const dkimLoading = computed(() => dkimStatus.value !== "success" && dkimStatus.value !== "error");

  const { data: dkimCheckData, refresh: refreshDkimCheck } = useAsyncData<DkimCheckResult | null>(
    "domain-admin-dkim-check",
    async () => {
      if (!domainId.value) return null;
      try {
        return await call<DkimCheckResult>(`/domains/${domainId.value}/dkim-check`);
      } catch {
        return null;
      }
    },
    { server: false, immediate: false, watch: [domainId], default: () => null }
  );
  const dkimCheck = computed(() => dkimCheckData.value);

  const isOwnerOrRoot = computed(
    () => isRoot.value || (domain.value?.ownerEmail != null && domain.value.ownerEmail === auth.session?.email)
  );

  watch(
    () => domain.value?.id,
    async (id) => {
      if (id == null) return; // still don't know yet -- keep the skeleton up
      if (accountOptions.value.length) {
        ownerOptionsLoading.value = false;
        return;
      }
      ownerOptionsLoading.value = true;
      try {
        const accounts = await call<{ id: string; email: string; displayName: string | null }[]>("/accounts/names").catch(
          () => []
        );
        accountOptions.value = accounts.map((a) => ({
          label: a.displayName ? `${a.displayName} (${a.email})` : a.email,
          value: a.id,
        }));
      } finally {
        ownerOptionsLoading.value = false;
      }
    },
    { immediate: true }
  );

  async function rotateDkim() {
    if (!domainId.value) return;
    try {
      await call(`/domains/${domainId.value}/dkim/rotate`, { method: "POST" });
      await Promise.all([refreshDkim(), refreshDkimCheck()]);
      toast.add({ title: t("domainDashboard.dkim.toast.rotated"), color: "success" });
    } catch (err) {
      toast.add({
        title: t("domainDashboard.dkim.toast.rotateFailed"),
        description: (err as Error).message,
        color: "error",
      });
    }
  }

  async function deleteDkim(selector: string) {
    if (!domainId.value) return;
    try {
      await call(`/domains/${domainId.value}/dkim/${selector}`, { method: "DELETE" });
      await Promise.all([refreshDkim(), refreshDkimCheck()]);
      toast.add({ title: t("domainDashboard.dkim.toast.deleted"), color: "success" });
    } catch (err) {
      toast.add({
        title: t("domainDashboard.dkim.toast.deleteFailed"),
        description: (err as Error).message,
        color: "error",
      });
    }
  }

  async function toggleActive(value: boolean) {
    if (!domainId.value) return;
    savingActive.value = true;
    try {
      await call(`/domains/${domainId.value}/active`, { method: "PATCH", body: { active: value } });
      await refreshDomain();
      toast.add({
        title: value ? t("domainDashboard.status.activated") : t("domainDashboard.status.deactivated"),
        color: "success",
      });
    } catch (e) {
      toast.add({ title: t("domainDashboard.status.toggleFailed"), description: (e as Error).message, color: "error" });
    } finally {
      savingActive.value = false;
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    toast.add({
      title: t("domainDashboard.dkim.copied"),
      icon: "i-lucide-copy",
      color: "success",
      duration: 1500,
    });
  }

  async function changeDomainOwner() {
    if (!domain.value || ownerPick.value === undefined) return;
    savingOwner.value = true;
    try {
      await call(`/domains/${domain.value.id}/owner`, { method: "PATCH", body: { newOwnerId: ownerPick.value } });
      await refreshDomain();
      ownerPick.value = undefined;
      toast.add({ title: t("domainDashboard.owner.saved"), color: "success" });
    } catch (e) {
      toast.add({ title: t("domainDashboard.owner.saveFailed"), description: (e as Error).message, color: "error" });
    } finally {
      savingOwner.value = false;
    }
  }

  return {
    domain,
    domainId,
    ownerPick,
    savingOwner,
    savingActive,
    accountOptions,
    ownerOptionsLoading,
    dkimKeys,
    dkimLoading,
    dkimCheck,
    isOwnerOrRoot,
    rotateDkim,
    deleteDkim,
    toggleActive,
    copyToClipboard,
    changeDomainOwner,
  };
}
