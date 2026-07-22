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
  seenBy,
  typingBy,
  notifyTyping,
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
  <div class="flex flex-col flex-1 min-h-0 gap-4 p-4 sm:p-6 xl:p-8 min-w-0">
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
        :seen-by="seenBy"
        :typing-by="typingBy"
        @load-older="loadOlder"
      >
        <template v-if="isClosed || canReply" #composer>
          <p v-if="isClosed" class="flex items-center gap-2 text-sm text-muted px-4 py-4 sm:px-6">
            <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
            {{ t("tickets.detail.closedNotice") }}
          </p>
          <TicketReplyEditor v-else ref="editor" :sending="sending" @send="onSend" @typing="notifyTyping" />
        </template>
      </TicketConversation>
    </template>
  </div>
</template>
