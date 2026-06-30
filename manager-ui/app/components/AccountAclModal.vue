<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  save: [number[]];
}>();

const props = defineProps<{
  open: boolean;
  username: string;
  domainOptions: { label: string; value: number }[];
  initialSelected: number[];
  saving: boolean;
}>();

const selected = ref<number[]>([]);

const { t } = useI18n();

watch(
  () => props.initialSelected,
  (v) => {
    selected.value = [...v];
  },
  { immediate: true }
);

function toggle(value: number, checked: boolean) {
  selected.value = checked ? [...selected.value, value] : selected.value.filter((id) => id !== value);
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("accounts.acl.title") }}</h3>
          <p class="text-sm text-muted">{{ username }}</p>
        </template>

        <p class="text-sm text-muted mb-3">{{ t("accounts.acl.hint") }}</p>
        <div class="space-y-2 max-h-56 overflow-y-auto border border-default rounded-md p-2">
          <label v-for="opt in domainOptions" :key="opt.value" class="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              :value="opt.value"
              :checked="selected.includes(opt.value)"
              class="rounded"
              @change="(e) => toggle(opt.value, (e.target as HTMLInputElement).checked)"
            />
            <span class="text-sm">{{ opt.label }}</span>
          </label>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" @click="emit('save', selected)">{{ t("accounts.acl.save") }}</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
