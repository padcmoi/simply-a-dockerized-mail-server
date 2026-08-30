<script setup lang="ts">
definePageMeta({});

// Loose on purpose: the API's `z.string().email()` is the authority, this only
// catches the obvious before a round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage, apiErrorStatus } = useApiError();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

const alias = ref<OwnedAlias | null>(null);
const loading = ref(true);
const loadError = ref<"notFound" | "failed" | null>(null);
const saving = ref(false);
const deleting = ref(false);
const confirmDelete = ref(false);
const form = reactive({ destination: "" });

const aliasId = computed(() => Number(route.params.id));
const destinationInvalid = computed(() => form.destination.length > 0 && !EMAIL_PATTERN.test(form.destination));
const dirty = computed(() => alias.value !== null && form.destination !== alias.value.destination);
const canSave = computed(() => EMAIL_PATTERN.test(form.destination) && dirty.value);

watch(aliasId, load, { immediate: true });

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.myspace"), to: "/my-space" }, { label: alias.value?.source ?? "..." }]);
});

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const found = await call<OwnedAlias>(`/my-space/aliases/${aliasId.value}`);
    alias.value = found;
    form.destination = found.destination;
  } catch (err) {
    loadError.value = apiErrorStatus(err) === 404 ? "notFound" : "failed";
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const updated = await call<OwnedAlias>(`/my-space/aliases/${aliasId.value}`, {
      method: "PATCH",
      body: { destination: form.destination },
    });
    alias.value = updated;
    form.destination = updated.destination;
    toast.add({ title: t("myspace.alias.saved"), color: "success" });
  } catch (err) {
    toast.add({ title: t("myspace.alias.saveFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}

async function remove() {
  deleting.value = true;
  try {
    await call(`/my-space/aliases/${aliasId.value}`, { method: "DELETE" });
    toast.add({ title: t("myspace.alias.deleted"), color: "success" });
    await navigateTo("/my-space");
  } catch (err) {
    toast.add({ title: t("myspace.alias.deleteFailed"), description: apiErrorMessage(err), color: "error" });
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
      <USkeleton class="h-48 w-full" />
    </div>

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="loadError === 'notFound' ? t('myspace.alias.notFound') : t('myspace.alias.loadFailed')"
    />

    <UCard v-else-if="alias">
      <template #header>
        <h2 class="font-semibold truncate flex items-center gap-2">
          <UIcon name="i-lucide-at-sign" class="size-4 text-muted shrink-0" />
          <TruncatedText :text="alias.source" :limit="40" />
        </h2>
      </template>

      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="rounded-md border border-default p-3 min-w-0">
            <p class="text-xs text-muted">{{ t("myspace.alias.source") }}</p>
            <TruncatedText :text="alias.source" :limit="34" text-class="font-medium" />
          </div>
          <div class="rounded-md border border-default p-3 min-w-0">
            <p class="text-xs text-muted">{{ t("common.domain") }}</p>
            <TruncatedText :text="alias.domain" :limit="34" text-class="font-medium" />
          </div>
        </div>

        <UFormField
          :label="t('myspace.alias.destination')"
          name="destination"
          :error="destinationInvalid ? t('myspace.alias.destinationInvalid') : undefined"
        >
          <UInput
            v-model="form.destination"
            :placeholder="t('myspace.alias.destinationPlaceholder')"
            autocomplete="off"
            class="w-full sm:max-w-md"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton icon="i-lucide-save" :disabled="!canSave" :loading="saving" @click="save">
            {{ t("myspace.alias.save") }}
          </UButton>
        </div>
      </template>
    </UCard>

    <UCard v-if="alias">
      <template #header>
        <h2 class="text-error font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-triangle-alert" class="size-4" />
          {{ t("myspace.alias.deleteTitle") }}
        </h2>
      </template>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p class="text-sm text-muted">{{ t("myspace.alias.deleteHint") }}</p>
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
          {{ t("myspace.alias.delete") }}
        </UButton>
      </div>
    </UCard>

    <ConfirmModal v-model:open="confirmDelete" :description="t('myspace.alias.deleteConfirm')" @confirm="remove" />
  </div>
</template>
