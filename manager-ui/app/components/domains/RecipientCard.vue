<script setup lang="ts">
const emit = defineEmits<{ delete: [] }>();

const props = withDefaults(
  defineProps<{
    item: { id: number; email: string; quota: string; usedBytes: string; active: number; lastActivity: string | null };
    isPostmaster?: boolean;
    canEdit?: boolean;
    editTo?: string | null;
  }>(),
  { isPostmaster: false, canEdit: false, editTo: null }
);

const editable = computed(() => props.canEdit && !props.isPostmaster && !!props.editTo);

const percent = computed(() => occupancyPercent(Number(props.item.quota), Number(props.item.usedBytes)));
const color = computed(() => occupancyColor(percent.value));

const { t } = useI18n();
const { formatDateTime } = useDateTime();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <NuxtLink v-if="editable" :to="editTo!" class="font-semibold break-all text-primary hover:underline">
          {{ item.email }}
        </NuxtLink>
        <span v-else class="font-semibold break-all">{{ item.email }}</span>
        <UBadge v-if="isPostmaster" color="neutral" variant="subtle" size="xs" icon="i-lucide-lock" class="shrink-0">
          {{ t("recipients.postmaster.badge") }}
        </UBadge>
      </div>
      <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm" class="shrink-0">
        {{ item.active ? t("common.yes") : t("common.no") }}
      </UBadge>
    </div>
    <div class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("recipients.table.quota") }}</span>
        <span>{{ formatBytes(Number(item.quota)) }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("recipients.table.used") }}</span>
        <span>{{ formatBytes(Number(item.usedBytes)) }}</span>
      </div>
      <UProgress :model-value="percent" :color="color" size="xs" />
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("common.lastModification") }}</span>
        <span>{{ formatDateTime(item.lastActivity) }}</span>
      </div>
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-end gap-2">
      <template v-if="!isPostmaster">
        <UButton v-if="editable" :to="editTo!" icon="i-lucide-pencil" size="sm" color="primary" variant="outline">
          {{ t("recipients.editPage.button") }}
        </UButton>
        <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
          {{ t("common.delete") }}
        </UButton>
      </template>
      <span v-else class="text-xs text-dimmed italic">{{ t("recipients.postmaster.locked") }}</span>
    </div>
  </UCard>
</template>
