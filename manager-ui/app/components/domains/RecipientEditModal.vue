<script setup lang="ts">
const emit = defineEmits<{ "update:open": [boolean]; save: [{ quotaMb: number; active: boolean }] }>();

const props = defineProps<{
  open: boolean;
  saving: boolean;
  item: { id: number; email: string; quota: string; active: number };
  minQuotaMb: number;
}>();

const MB = 1024 * 1024;

const activeField = ref(true);
const quotaMbField = ref(1);

const quotaUnderLimit = computed(() => quotaMbField.value < props.minQuotaMb);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    activeField.value = props.item.active === 1;
    const bytes = Number(props.item.quota);
    quotaMbField.value = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : props.minQuotaMb;
  },
  { immediate: true }
);

function onSave() {
  if (quotaUnderLimit.value) return;
  emit("save", { quotaMb: quotaMbField.value, active: activeField.value });
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("recipients.editModal.title", { email: item.email }) }}</h3>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('domains.form.active')">
            <USwitch v-model="activeField" />
          </UFormField>

          <UFormField
            :label="t('recipients.form.quotaMb')"
            :error="quotaUnderLimit ? t('recipients.form.quotaMin', { value: minQuotaMb }) : undefined"
          >
            <UInput v-model.number="quotaMbField" type="number" :min="minQuotaMb" class="w-32" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="quotaUnderLimit" @click="onSave">
              {{ t("common.save") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
