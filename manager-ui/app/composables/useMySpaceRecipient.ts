// One owned mailbox and everything the personal space can do to it: its status,
// its password, its quota within what the domain delegated, and its deletion.
// The page that shows it was carrying all of this itself.

const PASSWORD_MIN = 8;
const MB = 1024 * 1024;

export function useMySpaceRecipient(recipientId: () => number) {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage, apiErrorStatus } = useApiError();
  const toast = useToast();
  const { rows: myDelegations, refresh: refreshDelegations } = useMyDelegations();

  const recipient = ref<OwnedRecipient | null>(null);
  const loading = ref(true);
  const loadError = ref<"notFound" | "failed" | null>(null);
  const savingStatus = ref(false);
  const changingPassword = ref(false);
  const savingQuota = ref(false);
  const deleting = ref(false);
  const form = reactive({ active: true, password: "", quotaMb: 0 });

  const passwordTooShort = computed(() => form.password.length > 0 && form.password.length < PASSWORD_MIN);
  const canChangePassword = computed(() => form.password.length >= PASSWORD_MIN);
  const statusDirty = computed(() => recipient.value !== null && form.active !== recipient.value.active);
  const delegation = computed(() => myDelegations.value.find((d) => d.domain === recipient.value?.domain) ?? null);
  const currentQuotaMb = computed(() => (recipient.value ? Math.round(Number(recipient.value.quota) / MB) : 0));
  const remainingDelegationMb = computed(() =>
    delegation.value ? Math.max(0, delegation.value.quotaMb - Math.round(Number(delegation.value.usedBytes) / MB)) : 0
  );
  const maxQuotaMb = computed(() => currentQuotaMb.value + remainingDelegationMb.value);
  const minQuotaMb = computed(() => (recipient.value ? Math.max(1, Math.ceil(Number(recipient.value.usedBytes) / MB)) : 1));
  const quotaDirty = computed(() => recipient.value !== null && Math.round(Number(form.quotaMb)) !== currentQuotaMb.value);
  const quotaUnderMin = computed(() => Number(form.quotaMb) < minQuotaMb.value);
  const canSaveQuota = computed(() => quotaDirty.value && !quotaUnderMin.value);

  watch(recipientId, load, { immediate: true });

  watch(
    [() => form.quotaMb, maxQuotaMb],
    () => {
      if (delegation.value && Number(form.quotaMb) > maxQuotaMb.value) form.quotaMb = maxQuotaMb.value;
    },
    { immediate: true }
  );

  // No save button on either card: flipping the switch or moving the quota
  // writes on its own once the value settles. Only a real, valid change writes,
  // so loading the mailbox, or a slider passing through a refused value on its
  // way, stays silent (saveStatus and saveQuota check again when they fire).
  const autosaveStatus = useAutosave(saveStatus);
  const autosaveQuota = useAutosave(saveQuota);

  watch(
    () => form.active,
    () => {
      if (statusDirty.value) void autosaveStatus();
    }
  );

  watch(
    () => form.quotaMb,
    () => {
      if (canSaveQuota.value) void autosaveQuota();
    }
  );

  async function load() {
    loading.value = true;
    loadError.value = null;
    try {
      const found = await call<OwnedRecipient>(`/my-space/recipients/${recipientId()}`);
      recipient.value = found;
      form.active = found.active;
      form.quotaMb = Math.round(Number(found.quota) / MB);
    } catch (err) {
      loadError.value = apiErrorStatus(err) === 404 ? "notFound" : "failed";
    } finally {
      loading.value = false;
    }
  }

  async function saveStatus() {
    if (!recipient.value || !statusDirty.value) return;
    savingStatus.value = true;
    try {
      const updated = await call<OwnedRecipient>(`/my-space/recipients/${recipientId()}`, {
        method: "PATCH",
        body: { active: form.active },
      });
      recipient.value = updated;
      form.active = updated.active;
      toast.add({ title: t("myspace.recipient.statusSaved"), color: "success" });
    } catch (err) {
      toast.add({ title: t("myspace.recipient.statusFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      savingStatus.value = false;
    }
  }

  async function changePassword() {
    if (!canChangePassword.value) return;
    changingPassword.value = true;
    try {
      await call(`/my-space/recipients/${recipientId()}`, { method: "PATCH", body: { password: form.password } });
      form.password = "";
      toast.add({ title: t("myspace.recipient.passwordChanged"), color: "success" });
    } catch (err) {
      toast.add({ title: t("myspace.recipient.passwordFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      changingPassword.value = false;
    }
  }

  async function saveQuota() {
    if (!recipient.value || !canSaveQuota.value) return;
    savingQuota.value = true;
    try {
      const updated = await call<OwnedRecipient>(`/my-space/recipients/${recipientId()}`, {
        method: "PATCH",
        body: { quota: Math.round(Number(form.quotaMb)) * MB },
      });
      recipient.value = updated;
      form.quotaMb = Math.round(Number(updated.quota) / MB);
      toast.add({ title: t("myspace.recipient.quotaSaved"), color: "success" });
      await refreshDelegations();
    } catch (err) {
      toast.add({ title: t("myspace.recipient.quotaFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      savingQuota.value = false;
    }
  }

  async function remove() {
    deleting.value = true;
    try {
      await call(`/my-space/recipients/${recipientId()}`, { method: "DELETE" });
      toast.add({ title: t("myspace.recipient.deleted"), color: "success" });
      await navigateTo("/my-space");
    } catch (err) {
      toast.add({ title: t("myspace.recipient.deleteFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      deleting.value = false;
    }
  }

  return {
    PASSWORD_MIN,
    recipient,
    loading,
    loadError,
    form,
    delegation,
    passwordTooShort,
    canChangePassword,
    minQuotaMb,
    maxQuotaMb,
    quotaUnderMin,
    savingStatus,
    changingPassword,
    savingQuota,
    deleting,
    changePassword,
    remove,
  };
}
