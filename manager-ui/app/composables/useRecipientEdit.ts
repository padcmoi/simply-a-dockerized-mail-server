// Editing one mailbox from the administration: its status and quota inside the
// domain's headroom, the admin password reset, and the ownership rights the
// buttons obey. The page that shows the form was carrying all of this.

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 1;
const PASSWORD_MIN = 8;

export function useRecipientEdit() {
  const route = useRoute();
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const { domainId, domainFqdn } = useCurrentDomain();
  const { isRoot, hasDomain } = usePermissions();
  const { availableMb, loadHeadroom } = useRecipientHeadroom(domainId);

  const recipient = ref<RecipientDetail | null>(null);
  const loading = ref(true);
  const saving = ref(false);
  const changingPassword = ref(false);

  const form = reactive({ active: true, quotaMb: MIN_QUOTA_MB, password: "" });

  const recipientId = computed(() => Number(route.params.id));
  const listPath = computed(() => `/admin/domains/${domainFqdn.value}/recipients`);
  const isPostmaster = computed(() => !!recipient.value?.email.toLowerCase().startsWith("postmaster@"));
  const canAssignOwner = computed(
    () =>
      !isPostmaster.value &&
      !!domainId.value &&
      (isRoot.value || hasDomain(domainId.value, "mailboxes", "assign-recipient-owner"))
  );
  const canUnassignOwner = computed(
    () =>
      !isPostmaster.value &&
      !!domainId.value &&
      (isRoot.value || hasDomain(domainId.value, "mailboxes", "unassign-recipient-owner"))
  );

  // Shrinking below what the mailbox already stores would put it instantly over
  // quota and dovecot would bounce its mail, so its usage is the real floor.
  // Rounded up: 1.4 MB stored means 2 MB is the smallest quota that still fits.
  // The API refuses it too (recipients.quotaBelowUsage); blocking it here is the
  // preventive half, so the field never offers a value the save would reject.
  const usedMb = computed(() => (recipient.value ? Math.ceil(Number(recipient.value.usedBytes) / MB) : MIN_QUOTA_MB));
  const floorMb = computed(() => Math.max(MIN_QUOTA_MB, usedMb.value));

  // Resizing frees the recipient's own reservation first, so its ceiling is the
  // domain's remaining headroom plus what it already holds.
  const currentMb = computed(() => (recipient.value ? Math.floor(Number(recipient.value.quota) / MB) : 0));
  const maxQuotaMb = computed(() => Math.max(MIN_QUOTA_MB, availableMb.value + currentMb.value));

  // A mailbox whose usage has grown past the domain's remaining headroom would
  // hand the slider a max below its min, which reka clamps into an unusable
  // track. The number field keeps reporting the real bounds either way.
  const sliderMax = computed(() => Math.max(floorMb.value, maxQuotaMb.value));

  const quotaUnderLimit = computed(() => form.quotaMb < floorMb.value);
  const quotaOverLimit = computed(() => form.quotaMb > maxQuotaMb.value);

  // The password lives in its own card (admin reset, no old password required),
  // saved on its own button, so it stays out of the main form's dirty/save.
  const passwordTooShort = computed(() => form.password.length > 0 && form.password.length < PASSWORD_MIN);
  const canChangePassword = computed(() => form.password.length >= PASSWORD_MIN);

  // Nothing to save until something actually differs from what was loaded.
  const dirty = computed(
    () => recipient.value !== null && (form.active !== (recipient.value.active === 1) || form.quotaMb !== currentMb.value)
  );

  const formInvalid = computed(() => quotaUnderLimit.value || quotaOverLimit.value || !dirty.value);

  watch(domainId, load, { immediate: true });

  // `max` on a number input only bounds the spinner arrows: typing or pasting
  // walks straight past it, so the value is pulled back to the ceiling as it
  // changes. `maxQuotaMb` tracks the domain's headroom, which shrinks whenever
  // another recipient is resized, and the field must follow it down.
  watch([() => form.quotaMb, maxQuotaMb], ([value, max]) => {
    if (Number.isFinite(value) && value > max) form.quotaMb = max;
  });

  async function load() {
    if (!domainId.value) return;
    loading.value = true;
    try {
      const found = await call<RecipientDetail>(`/domains/${domainId.value}/recipients/${recipientId.value}`);
      recipient.value = found;
      form.active = found.active === 1;
      // An existing quota can sit below the floor (usage grew past it, or the
      // mailbox predates this rule); open on the floor so the field starts valid.
      form.quotaMb = Math.max(Math.round(Number(found.quota) / MB), floorMb.value);
    } catch (err) {
      toast.add({ title: t("recipients.editPage.loadFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    if (!domainId.value || formInvalid.value) return;
    saving.value = true;
    try {
      await call(`/domains/${domainId.value}/recipients/${recipientId.value}`, {
        method: "PATCH",
        body: { quota: form.quotaMb * MB, active: form.active },
      });
      await loadHeadroom();
      toast.add({ title: t("recipients.editPage.saved"), color: "success" });
      await navigateTo(listPath.value);
    } catch (err) {
      toast.add({ title: t("recipients.editPage.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  // Reset the mailbox password on its own, independent of the main form (no old
  // password required). Stays on the page and clears the field on success.
  async function changePassword() {
    if (!domainId.value || !canChangePassword.value) return;
    changingPassword.value = true;
    try {
      await call(`/domains/${domainId.value}/recipients/${recipientId.value}`, {
        method: "PATCH",
        body: { password: form.password },
      });
      form.password = "";
      toast.add({ title: t("recipients.editPage.passwordChanged"), color: "success" });
    } catch (err) {
      toast.add({ title: t("recipients.editPage.passwordFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      changingPassword.value = false;
    }
  }

  return {
    PASSWORD_MIN,
    recipient,
    loading,
    saving,
    changingPassword,
    form,
    listPath,
    isPostmaster,
    canAssignOwner,
    canUnassignOwner,
    floorMb,
    maxQuotaMb,
    sliderMax,
    quotaUnderLimit,
    quotaOverLimit,
    passwordTooShort,
    canChangePassword,
    formInvalid,
    load,
    save,
    changePassword,
  };
}
