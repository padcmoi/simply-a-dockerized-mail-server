<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import type { DateRangeValue } from "~/utils/date-range";

const emit = defineEmits<{ save: [] }>();

const model = defineModel<DateRangeValue>({ required: true });

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    icon?: string;
    disabled?: boolean;
    saveable?: boolean;
    saving?: boolean;
    canSave?: boolean;
  }>(),
  { title: undefined, description: undefined, icon: "i-lucide-calendar-range" }
);

const { t } = useI18n();

const calendarValue = shallowRef<{ start: DateValue | undefined; end: DateValue | undefined }>({
  start: dayToDateValue(model.value.start),
  end: dayToDateValue(model.value.end),
});

const startValue = computed({
  get: () => dayToDateValue(model.value.start),
  set: (value: DateValue | null | undefined) => {
    model.value = { ...model.value, start: dateValueToDay(value) };
  },
});

const endValue = computed({
  get: () => dayToDateValue(model.value.end),
  set: (value: DateValue | null | undefined) => {
    model.value = { ...model.value, end: dateValueToDay(value) };
  },
});

const startUnlimited = computed({
  get: () => !model.value.start,
  set: (unlimited: boolean) => {
    model.value = { ...model.value, start: unlimited ? null : (model.value.start ?? todayDay()) };
  },
});

const endUnlimited = computed({
  get: () => !model.value.end,
  set: (unlimited: boolean) => {
    model.value = { ...model.value, end: unlimited ? null : (model.value.end ?? model.value.start ?? todayDay()) };
  },
});

const reversed = computed(() => isDateRangeReversed(model.value));

watch(
  () => [model.value.start, model.value.end] as const,
  ([start, end]) => {
    if (dateValueToDay(calendarValue.value.start) === start && dateValueToDay(calendarValue.value.end) === end) return;
    calendarValue.value = { start: dayToDateValue(start), end: dayToDateValue(end) };
  }
);

watch(calendarValue, (range) => {
  if (!range?.start || !range?.end) return;
  model.value = { start: dateValueToDay(range.start), end: dateValueToDay(range.end) };
});
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold flex items-center gap-1.5">
        <UIcon :name="props.icon" class="size-4 text-muted" />
        {{ props.title ?? t("common.dateRange.title") }}
      </h2>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-muted">{{ props.description ?? t("common.dateRange.description") }}</p>

      <div class="w-full sm:w-fit max-w-full space-y-4">
        <div class="flex flex-wrap gap-x-8 gap-y-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-default">{{ t("common.dateRange.start") }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <UInputDate v-model="startValue" :disabled="disabled || startUnlimited" />
              <UCheckbox v-model="startUnlimited" :label="t('common.dateRange.unlimited')" :disabled="disabled" />
            </div>
          </div>

          <div class="space-y-1.5">
            <p class="text-sm font-medium text-default">{{ t("common.dateRange.end") }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <UInputDate v-model="endValue" :disabled="disabled || endUnlimited" />
              <UCheckbox v-model="endUnlimited" :label="t('common.dateRange.unlimited')" :disabled="disabled" />
            </div>
          </div>
        </div>

        <p v-if="reversed" class="text-sm text-error">{{ t("common.dateRange.endBeforeStart") }}</p>

        <UCalendar v-model="calendarValue" range :disabled="disabled" class="w-full" />
      </div>
    </div>

    <template v-if="saveable" #footer>
      <div class="flex justify-end">
        <UButton icon="i-lucide-save" :disabled="!canSave || reversed" :loading="saving" @click="emit('save')">
          {{ t("common.save") }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
