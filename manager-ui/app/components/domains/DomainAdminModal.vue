<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  save: [{ domain: string; quotaMb: number }];
  delete: [];
}>();

const props = defineProps<{
  open: boolean;
  saving: boolean;
  item: { id: number; domain: string; quota: string; active: number };
  minQuotaMb: number;
  maxQuotaMb: number;
  canDelete: boolean;
}>();

const MB = 1024 * 1024;
const FQDN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const confirmDeleteOpen = ref(false);
const domainField = ref("");
const quotaMbField = ref(10);

const domainInvalid = computed(() => !FQDN_RE.test(domainField.value.trim()));
const quotaUnderLimit = computed(() => quotaMbField.value < props.minQuotaMb);
const quotaOverLimit = computed(() => quotaMbField.value > props.maxQuotaMb);
const hasError = computed(() => domainInvalid.value || quotaUnderLimit.value || quotaOverLimit.value);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    domainField.value = props.item.domain;
    const bytes = Number(props.item.quota);
    quotaMbField.value = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : props.minQuotaMb;
  },
  { immediate: true }
);

function onSave() {
  if (hasError.value) return;
  emit("save", { domain: domainField.value.trim().toLowerCase(), quotaMb: quotaMbField.value });
}

function onDeleteConfirmed() {
  emit("delete");
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("domains.adminModal.title") }}</h3>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('domains.form.fqdn')" :error="domainInvalid ? t('domains.adminModal.fqdnInvalid') : undefined">
            <UInput v-model="domainField" icon="i-lucide-globe" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('domains.form.quotaMb')"
            :error="
              quotaUnderLimit
                ? t('domains.form.quotaMin', { value: minQuotaMb })
                : quotaOverLimit
                  ? t('domains.form.quotaMax', { value: maxQuotaMb })
                  : undefined
            "
            :hint="t('domains.form.quotaRange', { min: minQuotaMb, max: maxQuotaMb })"
          >
            <UInput v-model.number="quotaMbField" type="number" :min="minQuotaMb" :max="maxQuotaMb" class="w-32" />
          </UFormField>

          <div v-if="canDelete" class="pt-4 mt-2 border-t border-default">
            <p class="text-sm font-medium text-error mb-2">{{ t("domains.adminModal.dangerZone") }}</p>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="outline"
              size="sm"
              @click="
                () => {
                  confirmDeleteOpen = true;
                }
              "
            >
              {{ t("domains.adminModal.delete") }}
            </UButton>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="hasError" @click="onSave">
              {{ t("common.save") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <ConfirmModal
    v-model:open="confirmDeleteOpen"
    type="danger"
    :title="t('domains.adminModal.confirmDelete')"
    :description="t('domains.adminModal.confirmDeleteDesc', { domain: item.domain })"
    @confirm="onDeleteConfirmed"
  />
</template>
