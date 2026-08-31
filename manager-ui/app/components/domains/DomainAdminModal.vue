<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  save: [{ quotaMb: number }];
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

const confirmDeleteOpen = ref(false);
const quotaMbField = ref(10);

const quotaUnderLimit = computed(() => quotaMbField.value < props.minQuotaMb);
const quotaOverLimit = computed(() => quotaMbField.value > props.maxQuotaMb);
const hasError = computed(() => quotaUnderLimit.value || quotaOverLimit.value);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    const bytes = Number(props.item.quota);
    quotaMbField.value = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : props.minQuotaMb;
  },
  { immediate: true }
);

// Quota is the only editable field: there is no rename route on the API, at any
// permission tier (see admin-domains.controller.ts).
function onSave() {
  if (hasError.value) return;
  emit("save", { quotaMb: quotaMbField.value });
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
          <UFormField :label="t('domains.form.fqdn')" :hint="t('domains.adminModal.fqdnLocked')">
            <UInput :model-value="item.domain" icon="i-lucide-globe" disabled class="w-full" />
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
