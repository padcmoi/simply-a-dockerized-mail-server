<script setup lang="ts">
const emit = defineEmits<{ "update:open": [boolean]; save: [{ quotaMb: number; active: boolean }] }>();

const props = defineProps<{
  open: boolean;
  saving: boolean;
  item: { id: number; email: string; quota: string; usedBytes: string; active: number };
  minQuotaMb: number;
  maxQuotaMb: number;
}>();

const MB = 1024 * 1024;

const activeField = ref(true);
const quotaMbField = ref(1);

// Shrinking below what the mailbox already stores would put it instantly over
// quota and dovecot would bounce its mail, so its usage is the real floor.
// Rounded up: 1.4 MB stored means 2 MB is the smallest quota that still fits.
const usedMb = computed(() => Math.ceil(Number(props.item.usedBytes) / MB));
const floorMb = computed(() => Math.max(props.minQuotaMb, usedMb.value));

const quotaUnderLimit = computed(() => quotaMbField.value < floorMb.value);
// `maxQuotaMb` already includes this recipient's own reservation, so the
// value it currently holds always passes.
const quotaOverLimit = computed(() => quotaMbField.value > props.maxQuotaMb);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    activeField.value = props.item.active === 1;
    const bytes = Number(props.item.quota);
    const current = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : props.minQuotaMb;
    // An existing quota can sit below the floor (usage grew past it, or the
    // mailbox predates this rule); open on the floor so the field starts valid.
    quotaMbField.value = Math.max(current, floorMb.value);
  },
  { immediate: true }
);

function onSave() {
  if (quotaUnderLimit.value || quotaOverLimit.value) return;
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
            :error="
              quotaUnderLimit
                ? t('recipients.form.quotaMin', { value: floorMb })
                : quotaOverLimit
                  ? t('recipients.form.quotaMax', { value: maxQuotaMb })
                  : undefined
            "
            :hint="t('recipients.form.quotaRange', { min: floorMb, max: maxQuotaMb })"
          >
            <UInput v-model.number="quotaMbField" type="number" :min="floorMb" :max="maxQuotaMb" class="w-32" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="quotaUnderLimit || quotaOverLimit" @click="onSave">
              {{ t("common.save") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
