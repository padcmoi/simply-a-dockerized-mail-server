<script setup lang="ts">
import type { GroupMember } from "~/composables/useGroups";

const emit = defineEmits<{
  add: [number];
  remove: [number];
}>();

const props = defineProps<{
  members: GroupMember[];
  accountOptions: { label: string; value: number }[];
  adding: boolean;
}>();

const pickedId = ref<number | null>(null);

const { t } = useI18n();

const availableOptions = computed(() => {
  const memberIds = new Set(props.members.map((m) => m.id));
  return props.accountOptions.filter((o) => !memberIds.has(o.value));
});

function onAdd() {
  if (pickedId.value === null) return;
  emit("add", pickedId.value);
  pickedId.value = null;
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-semibold">{{ t("groups.detail.members.title") }}</h3>
    </template>

    <div class="flex flex-wrap gap-2 mb-4">
      <select v-model.number="pickedId" class="border border-default rounded-md px-2 py-1.5 text-sm bg-default min-w-[12rem]">
        <option :value="null">{{ t("groups.detail.members.pickPlaceholder") }}</option>
        <option v-for="opt in availableOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <UButton icon="i-lucide-user-plus" size="sm" color="primary" :loading="adding" :disabled="pickedId === null" @click="onAdd">
        {{ t("groups.detail.members.add") }}
      </UButton>
    </div>

    <p v-if="members.length === 0" class="text-sm text-muted">{{ t("groups.detail.members.empty") }}</p>
    <ul v-else class="divide-y divide-default">
      <li v-for="m in members" :key="m.id" class="flex items-center justify-between gap-2 py-2">
        <div class="min-w-0 flex items-center gap-2">
          <UAvatar :alt="m.name ?? m.username" size="xs" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ m.username }}</p>
            <p v-if="m.email" class="text-xs text-muted truncate">{{ m.email }}</p>
          </div>
        </div>
        <UButton
          icon="i-lucide-user-minus"
          size="xs"
          color="error"
          variant="ghost"
          square
          :title="t('groups.detail.members.remove')"
          @click="emit('remove', m.id)"
        />
      </li>
    </ul>
  </UCard>
</template>
