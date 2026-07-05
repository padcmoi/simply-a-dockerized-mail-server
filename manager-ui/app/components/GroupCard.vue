<script setup lang="ts">
import type { GroupItem } from "~/composables/useGroups";

const emit = defineEmits<{ delete: [] }>();

defineProps<{ group: GroupItem }>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink :to="`/groups/${group.id}`" class="font-semibold truncate hover:underline min-w-0">{{ group.name }}</NuxtLink>
          <UBadge v-if="group.isDefault" color="primary" variant="subtle" size="xs" class="shrink-0">{{ t("groups.defaultBadge") }}</UBadge>
        </div>
        <p class="text-sm text-muted truncate">{{ group.description || t("groups.noDescription") }}</p>
      </div>
      <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" square @click="emit('delete')" />
    </div>
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>{{ t("groups.table.owner") }}: {{ group.ownerUsername ?? "-" }}</span>
      <span>{{ t("groups.table.members") }}: {{ group.memberCount }}</span>
    </div>
  </UCard>
</template>
