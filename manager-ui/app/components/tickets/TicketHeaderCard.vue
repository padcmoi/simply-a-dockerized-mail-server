<script setup lang="ts">
const emit = defineEmits<{ take: []; changeStatus: [status: string] }>();

const props = defineProps<{
  ticket: TicketDetail;
  canHandle: boolean;
  canTake: boolean;
  isAuthor: boolean;
  busy: boolean;
}>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

const statusOptions = computed<{ value: string; label: string }[]>(() =>
  TICKET_STATUSES.map((s) => ({ value: s, label: t(`tickets.status.${s}`) }))
);

// Without the support role the author still gets one lever on their own
// ticket: giving up on it. Reopening it stays a support decision.
const canCloseOwn = computed(() => !props.canHandle && props.isAuthor && props.ticket.status !== "closed");
</script>

<template>
  <UCard>
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-semibold truncate">{{ ticket.subject }}</h1>
        <p class="text-xs text-muted mt-1">
          {{ ticket.domainName }} &middot;
          {{ t("tickets.detail.openedBy", { who: ticket.creatorName ?? ticket.creatorEmail ?? t("tickets.detail.unknown") }) }}
          &middot; {{ formatDateTime(ticket.createdAt) }}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UBadge :color="ticket.visibility === 'public' ? 'neutral' : 'warning'" variant="subtle">
          {{ t(`tickets.visibility.${ticket.visibility}`) }}
        </UBadge>
        <UBadge :color="ticketStatusColor(ticket.status)" variant="subtle">
          {{ t(`tickets.status.${ticket.status}`) }}
        </UBadge>
      </div>
    </div>

    <div v-if="canCloseOwn" class="mt-4 flex flex-wrap items-center gap-3 border-t border-default pt-4">
      <span class="text-xs text-muted">{{ t("tickets.detail.authorCloseHint") }}</span>
      <UButton
        icon="i-lucide-lock"
        color="neutral"
        variant="subtle"
        size="sm"
        class="sm:ml-auto"
        :loading="busy"
        @click="emit('changeStatus', 'closed')"
      >
        {{ t("tickets.table.closeOwn") }}
      </UButton>
    </div>

    <div v-else-if="canHandle" class="mt-4 flex flex-wrap items-center gap-3 border-t border-default pt-4">
      <UButton v-if="canTake" icon="i-lucide-hand" size="sm" :loading="busy" @click="emit('take')">
        {{ t("tickets.detail.take") }}
      </UButton>
      <span v-else-if="ticket.assigneeEmail" class="flex items-center gap-2 text-xs text-muted">
        <UAvatar :src="ticket.assigneeAvatarUrl ?? undefined" :alt="ticket.assigneeName ?? ticket.assigneeEmail" size="3xs" />
        {{ ticket.assigneeName ?? ticket.assigneeEmail }}
      </span>
      <span v-else-if="isAuthor" class="text-xs text-dimmed">{{ t("tickets.detail.authorCannotTake") }}</span>
      <div class="flex items-center gap-2 sm:ml-auto">
        <span class="text-xs text-muted">{{ t("tickets.detail.changeStatus") }}</span>
        <USelectMenu
          :model-value="ticket.status"
          value-key="value"
          :items="statusOptions"
          :disabled="busy"
          class="w-40"
          @update:model-value="emit('changeStatus', $event)"
        />
      </div>
    </div>
  </UCard>
</template>
