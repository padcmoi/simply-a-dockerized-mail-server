<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "tickets", action: "access" },
    { resource: "tickets", action: "view-ticket" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

const editor = useTemplateRef<{ clear: () => void }>("editor");

const ticketId = computed(() => Number(route.params.id));

const {
  ticket,
  messages,
  total,
  hasOlder,
  loading,
  loadingOlder,
  sending,
  busy,
  canHandle,
  canTake,
  canReply,
  isClosed,
  isAuthor,
  isMine,
  loadOlder,
  send,
  take,
  changeStatus,
} = useTicketThread(ticketId);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.tickets"), to: "/tickets" }, { label: ticket.value?.subject ?? "..." }]);
});

async function onSend(body: string) {
  if (await send(body)) editor.value?.clear();
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/tickets" size="sm">
      {{ t("tickets.detail.backToList") }}
    </UButton>

    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-10 w-2/3" />
      <USkeleton v-for="i in 3" :key="i" class="h-20 w-full" />
    </div>

    <template v-else-if="ticket">
      <TicketHeaderCard
        :ticket="ticket"
        :can-handle="canHandle"
        :can-take="canTake"
        :is-author="isAuthor"
        :busy="busy"
        @take="take"
        @change-status="changeStatus"
      />

      <TicketConversation
        :messages="messages"
        :total="total"
        :has-older="hasOlder"
        :loading-older="loadingOlder"
        :is-mine="isMine"
        @load-older="loadOlder"
      />

      <UAlert
        v-if="isClosed"
        icon="i-lucide-lock"
        color="neutral"
        variant="subtle"
        :description="t('tickets.detail.closedNotice')"
      />
      <TicketReplyEditor v-else-if="canReply" ref="editor" :sending="sending" @send="onSend" />
    </template>
  </div>
</template>
