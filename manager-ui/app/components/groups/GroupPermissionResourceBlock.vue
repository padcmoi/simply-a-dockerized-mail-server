<script setup lang="ts">
const emit = defineEmits<{
  toggle: [action: string, checked: boolean];
  checkAll: [checked: boolean];
}>();

const props = defineProps<{
  resource: string;
  label: string;
  actions: readonly string[];
  actionLabels: Record<string, string>;
  permissions: Set<string>;
}>();

const { t } = useI18n();

function isChecked(action: string) {
  return props.permissions.has(`${props.resource}:${action}`);
}

function isDisabled(action: string) {
  return action !== "access" && !props.permissions.has(`${props.resource}:access`);
}
</script>

<template>
  <div class="border border-default rounded-lg p-3">
    <div class="flex items-center justify-between gap-2 mb-2">
      <h4 class="font-medium text-sm">{{ label }}</h4>
      <div class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" @click="emit('checkAll', true)">
          {{ t("groups.permissions.checkAll") }}
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="emit('checkAll', false)">
          {{ t("groups.permissions.uncheckAll") }}
        </UButton>
      </div>
    </div>
    <div class="flex flex-wrap gap-x-5 gap-y-2">
      <UCheckbox
        v-for="action in actions"
        :key="action"
        variant="card"
        :ui="{ root: 'border-0 rounded-none p-0' }"
        :model-value="isChecked(action)"
        :disabled="isDisabled(action)"
        :label="actionLabels[action] ?? action"
        @update:model-value="(val) => emit('toggle', action, val === true)"
      />
    </div>
  </div>
</template>
