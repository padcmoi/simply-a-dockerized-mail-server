<script setup lang="ts">
const form = defineModel<DelegationCapsForm>({ required: true });

const props = defineProps<{ withExpiry: boolean; maxQuotaMb?: number | null }>();

const { t } = useI18n();

const quotaPercent = computed(() => {
  if (typeof props.maxQuotaMb !== "number" || props.maxQuotaMb <= 0) return 0;
  return Math.min(100, Math.round((Number(form.value.quotaMb) / props.maxQuotaMb) * 100));
});

watch(
  [() => form.value.quotaMb, () => props.maxQuotaMb],
  () => {
    if (typeof props.maxQuotaMb === "number" && Number(form.value.quotaMb) > props.maxQuotaMb) {
      form.value.quotaMb = props.maxQuotaMb;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="space-y-4">
    <!-- The checkboxes stand OUTSIDE the UFormField: a form field shares one
         reactive input id with every control placed inside it, so a checkbox
         within the same field ends up labelled onto the number input and
         clicking its label focuses that input instead of toggling. -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-2">
        <UFormField :label="t('domains.delegations.maxRecipients')">
          <UInput v-model.number="form.maxRecipients" type="number" min="0" class="w-full" :disabled="form.unlimitedRecipients" />
        </UFormField>
        <UCheckbox v-model="form.unlimitedRecipients" :label="t('domains.delegations.unlimited')" />
      </div>
      <div class="space-y-2">
        <UFormField :label="t('domains.delegations.maxAliases')">
          <UInput v-model.number="form.maxAliases" type="number" min="0" class="w-full" :disabled="form.unlimitedAliases" />
        </UFormField>
        <UCheckbox v-model="form.unlimitedAliases" :label="t('domains.delegations.unlimited')" />
      </div>
    </div>

    <div class="space-y-2">
      <UFormField :label="t('domains.delegations.quotaMb')" :description="t('domains.delegations.quotaHint')" required>
        <UInput
          v-model.number="form.quotaMb"
          type="number"
          min="0"
          :max="typeof maxQuotaMb === 'number' ? maxQuotaMb : undefined"
          class="w-full"
        />
      </UFormField>
      <template v-if="maxQuotaMb !== undefined">
        <template v-if="maxQuotaMb === null">
          <p class="text-xs text-muted">{{ t("domains.delegations.quotaAvailableUnlimited") }}</p>
        </template>
        <template v-else>
          <UProgress :model-value="quotaPercent" size="sm" />
          <p class="text-xs text-muted">
            {{ t("domains.delegations.quotaAvailable", { used: Math.round(Number(form.quotaMb) || 0), max: maxQuotaMb }) }}
          </p>
        </template>
      </template>
    </div>

    <div v-if="withExpiry" class="space-y-2">
      <UFormField :label="t('domains.delegations.expiryDays')">
        <UInput v-model.number="form.expiresDays" type="number" min="1" max="3650" class="w-full" :disabled="form.noExpiry" />
      </UFormField>
      <UCheckbox v-model="form.noExpiry" :label="t('domains.delegations.noExpiry')" />
    </div>
  </div>
</template>
