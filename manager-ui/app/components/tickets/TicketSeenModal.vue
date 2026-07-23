<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();

defineProps<{ open: boolean; readers: TicketReader[] }>();

const { t } = useI18n();
const { formatDateTime, timeAgo } = useDateTime();
</script>

<template>
  <UModal :open="open" @update:open="emit('close')">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("tickets.detail.seenTitle") }}</h3>
        </template>

        <p v-if="!readers.length" class="text-sm text-muted">{{ t("tickets.detail.notSeenYet") }}</p>

        <ul v-else class="space-y-3">
          <li v-for="reader in readers" :key="reader.accountId" class="flex items-center gap-3">
            <UAvatar :src="reader.avatarUrl ?? undefined" :alt="reader.name ?? '?'" size="xs" class="shrink-0" />
            <span class="text-sm truncate">{{ reader.name ?? t("tickets.detail.unknown") }}</span>
            <span class="ms-auto text-xs text-muted shrink-0" :title="formatDateTime(reader.readAt)">
              {{ timeAgo(reader.readAt) ?? formatDateTime(reader.readAt) }}
            </span>
          </li>
        </ul>
      </UCard>
    </template>
  </UModal>
</template>
