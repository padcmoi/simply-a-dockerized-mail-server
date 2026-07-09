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

// A mailbox whose usage has grown past the domain's remaining headroom would
// hand the slider a max below its min, which reka clamps into an unusable
// track. The number field keeps reporting the real bounds either way.
const sliderMax = computed(() => Math.max(floorMb.value, props.maxQuotaMb));

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

// `max` on a number input only bounds the spinner arrows: typing or pasting
// walks straight past it, so the value is pulled back to the ceiling as it
// changes. The floor is left alone -- clamping it would rewrite a leading "0"
// into the minimum mid-keystroke.
//
// `maxQuotaMb` is watched too: it tracks the domain's headroom, which shrinks
// whenever another recipient is resized, and the field must follow it down
// rather than hold a value the API would now refuse.
watch([quotaMbField, () => props.maxQuotaMb], ([value, max]) => {
  if (Number.isFinite(value) && value > max) quotaMbField.value = max;
});

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
            <!-- Slider and number field are two views of `quotaMbField`, so
                 moving either moves the other. -->
            <div class="space-y-4">
              <UInput v-model.number="quotaMbField" type="number" :min="floorMb" :max="maxQuotaMb" class="w-32" />
              <USlider v-model="quotaMbField" :min="floorMb" :max="sliderMax" :step="1" class="px-1" />
            </div>
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
