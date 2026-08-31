<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const emit = defineEmits<{ changed: [] }>();

const props = defineProps<{ ticket: TicketRow }>();

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { isRoot, hasGlobal } = usePermissions();
const toast = useToast();
const auth = useAuthStore();

const busy = ref(false);

const canHandle = computed(() => isRoot.value || hasGlobal("tickets", "handle-ticket"));
const isAuthor = computed(() => !!auth.session?.accountId && props.ticket.createdBy === auth.session.accountId);
// The author may always give up on their own request, but only that.
const canClose = computed(() => !canHandle.value && isAuthor.value && props.ticket.status !== "closed");

const statusOptions = computed<{ value: string; label: string }[]>(() =>
  TICKET_STATUSES.map((s) => ({ value: s, label: t(`tickets.status.${s}`) }))
);

async function apply(next: string) {
  if (next === props.ticket.status) return;
  busy.value = true;
  try {
    await call(`/tickets/${props.ticket.id}/status`, { method: "PATCH", body: { status: next } });
    toast.add({ title: t("tickets.toast.statusChanged"), color: "success", icon: "i-lucide-check" });
    emit("changed");
  } catch (e) {
    toast.add({ title: apiErrorMessage(e), color: "error", icon: "i-lucide-triangle-alert" });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <USelectMenu
    v-if="canHandle"
    :model-value="ticket.status"
    value-key="value"
    :items="statusOptions"
    :disabled="busy"
    size="xs"
    class="w-36"
    @click.stop
    @update:model-value="apply"
  />

  <span v-else class="flex items-center gap-2">
    <UBadge :color="ticketStatusColor(ticket.status)" variant="subtle">
      {{ t(`tickets.status.${ticket.status}`) }}
    </UBadge>
    <UButton
      v-if="canClose"
      icon="i-lucide-lock"
      color="neutral"
      variant="ghost"
      size="xs"
      :loading="busy"
      :title="t('tickets.table.closeOwn')"
      :aria-label="t('tickets.table.closeOwn')"
      @click.stop="apply('closed')"
    />
  </span>
</template>
