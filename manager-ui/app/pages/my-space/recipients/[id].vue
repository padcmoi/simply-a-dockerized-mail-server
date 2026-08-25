<script setup lang="ts">
definePageMeta({});

interface MyRecipient {
  id: number;
  email: string;
  domain: string;
  quota: string;
  usedBytes: string;
  active: boolean;
}

const PASSWORD_MIN = 8;
const MB = 1024 * 1024;

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage, apiErrorStatus } = useApiError();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { rows: myDelegations, refresh: refreshDelegations } = useMyDelegations();

const recipient = ref<MyRecipient | null>(null);
const loading = ref(true);
const loadError = ref<"notFound" | "failed" | null>(null);
const savingStatus = ref(false);
const changingPassword = ref(false);
const savingQuota = ref(false);
const deleting = ref(false);
const confirmDelete = ref(false);
const form = reactive({ active: true, password: "", quotaMb: 0 });

const recipientId = computed(() => Number(route.params.id));

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

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.myspace"), to: "/my-space" }, { label: recipient.value?.email ?? "..." }]);
});

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const found = await call<MyRecipient>(`/my-space/recipients/${recipientId.value}`);
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
    const updated = await call<MyRecipient>(`/my-space/recipients/${recipientId.value}`, {
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
    await call(`/my-space/recipients/${recipientId.value}`, { method: "PATCH", body: { password: form.password } });
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
    const updated = await call<MyRecipient>(`/my-space/recipients/${recipientId.value}`, {
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
    await call(`/my-space/recipients/${recipientId.value}`, { method: "DELETE" });
    toast.add({ title: t("myspace.recipient.deleted"), color: "success" });
    await navigateTo("/my-space");
  } catch (err) {
    toast.add({ title: t("myspace.recipient.deleteFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/my-space" size="sm">
      {{ t("myspace.backToSpace") }}
    </UButton>

    <div v-if="loading" class="space-y-4">
      <USkeleton v-for="i in 2" :key="i" class="h-40 w-full" />
    </div>

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="loadError === 'notFound' ? t('myspace.recipient.notFound') : t('myspace.recipient.loadFailed')"
    />

    <template v-else-if="recipient">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard :ui="{ root: 'flex flex-col', body: 'flex-1 flex items-center' }">
          <template #header>
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="rounded-md p-2 bg-elevated shrink-0">
                <UIcon name="i-lucide-mailbox" class="size-4 text-primary" />
              </div>
              <div class="min-w-0">
                <TruncatedText :text="recipient.email" :limit="40" text-class="font-semibold" />
                <p class="text-xs text-muted truncate">{{ recipient.domain }}</p>
              </div>
            </div>
          </template>

          <MailboxUsageDonut :total-bytes="Number(recipient.quota)" :used-bytes="Number(recipient.usedBytes)" />
        </UCard>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="font-semibold flex items-center gap-1.5">
                <UIcon name="i-lucide-power" class="size-4 text-muted" />
                {{ t("myspace.recipient.active") }}
              </h2>
            </template>

            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <USwitch v-model="form.active" />
                <UBadge :color="form.active ? 'success' : 'neutral'" variant="subtle">
                  {{ form.active ? t("common.active") : t("common.inactive") }}
                </UBadge>
              </div>
              <p class="text-sm text-muted">{{ t("myspace.recipient.activeHint") }}</p>
            </div>

            <template #footer>
              <div class="flex justify-end">
                <UButton icon="i-lucide-save" :disabled="!statusDirty" :loading="savingStatus" @click="saveStatus">
                  {{ t("myspace.recipient.statusSave") }}
                </UButton>
              </div>
            </template>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold flex items-center gap-1.5">
                <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
                {{ t("myspace.recipient.passwordTitle") }}
              </h2>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">{{ t("myspace.recipient.passwordHint") }}</p>
              <div class="flex items-end gap-2">
                <UFormField
                  :label="t('myspace.recipient.newPassword')"
                  :error="passwordTooShort ? t('myspace.recipient.passwordMin', { value: PASSWORD_MIN }) : undefined"
                  class="flex-1 sm:max-w-sm"
                >
                  <UInput
                    v-model="form.password"
                    type="password"
                    autocomplete="new-password"
                    :placeholder="t('myspace.recipient.newPasswordPlaceholder')"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  icon="i-lucide-key-round"
                  :disabled="!canChangePassword"
                  :loading="changingPassword"
                  @click="changePassword"
                >
                  {{ t("myspace.recipient.changePassword") }}
                </UButton>
              </div>
            </div>
          </UCard>

          <UCard v-if="delegation">
            <template #header>
              <h2 class="font-semibold flex items-center gap-1.5">
                <UIcon name="i-lucide-database" class="size-4 text-muted" />
                {{ t("myspace.recipient.quota") }}
              </h2>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">{{ t("myspace.recipient.quotaEditHint") }}</p>
              <UFormField
                :label="t('myspace.delegations.quotaMb')"
                :hint="t('recipients.form.quotaRange', { min: minQuotaMb, max: maxQuotaMb })"
                :error="quotaUnderMin ? t('recipients.form.quotaMin', { value: minQuotaMb }) : undefined"
              >
                <div class="space-y-4">
                  <UInput v-model.number="form.quotaMb" type="number" :min="minQuotaMb" :max="maxQuotaMb" class="w-32" />
                  <USlider v-model="form.quotaMb" :min="minQuotaMb" :max="maxQuotaMb" :step="1" class="px-1" />
                </div>
              </UFormField>
              <p class="text-xs text-muted">
                {{ t("myspace.delegations.quotaAvailable", { used: Math.round(Number(form.quotaMb) || 0), max: maxQuotaMb }) }}
              </p>
            </div>

            <template #footer>
              <div class="flex justify-end">
                <UButton icon="i-lucide-save" :disabled="!canSaveQuota" :loading="savingQuota" @click="saveQuota">
                  {{ t("myspace.recipient.statusSave") }}
                </UButton>
              </div>
            </template>
          </UCard>
        </div>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-error font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-triangle-alert" class="size-4" />
            {{ t("myspace.recipient.deleteTitle") }}
          </h2>
        </template>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="text-sm text-muted">{{ t("myspace.recipient.deleteHint") }}</p>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :loading="deleting"
            @click="
              () => {
                confirmDelete = true;
              }
            "
          >
            {{ t("myspace.recipient.delete") }}
          </UButton>
        </div>
      </UCard>

      <ConfirmModal v-model:open="confirmDelete" :description="t('myspace.recipient.deleteConfirm')" @confirm="remove" />
    </template>
  </div>
</template>
