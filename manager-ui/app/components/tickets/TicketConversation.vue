<script setup lang="ts">
const emit = defineEmits<{ loadOlder: []; quote: [author: string, body: string] }>();

const props = defineProps<{
  messages: TicketMessage[];
  total: number;
  hasOlder: boolean;
  loadingOlder: boolean;
  isMine: (_message: TicketMessage) => boolean;
  canEdit: (_message: TicketMessage) => boolean;
  editMessage: (_id: number, _body: string) => Promise<boolean>;
  seenBy: (_message: TicketMessage) => TicketReader[];
  typingBy: { userId: string; who: string } | null;
}>();

const { t } = useI18n();
const { isOnline, lastSeenAt } = usePresence();

// Tapping the ticks or an avatar opens the detail: a phone has no hover, so a
// tooltip alone would keep this information out of reach there.
const seenReaders = ref<TicketReader[] | null>(null);
const presenceTarget = ref<{ name: string; avatarUrl: string | null; online?: boolean; lastSeenAt: string | null } | null>(null);
const { editingId, editDraft, savingEdit, remainingLabel, expired, startEdit, cancelEdit, saveEdit } = useTicketMessageEdit(
  props.editMessage
);

const { entries, formatDateTime } = useMessageThread(
  () => props.messages,
  (message) => props.isMine(message)
);

const { onScroll, requestOlder } = useThreadScroll({
  firstId: () => props.messages[0]?.id,
  lastId: () => props.messages.at(-1)?.id,
  loadingOlder: () => props.loadingOlder,
  onLoadOlder: () => emit("loadOlder"),
});

function openPresence(message: TicketMessage) {
  presenceTarget.value = {
    name: message.authorName ?? message.authorEmail ?? t("tickets.detail.unknown"),
    avatarUrl: message.authorAvatarUrl,
    online: message.authorId ? isOnline(message.authorId) : undefined,
    lastSeenAt: lastSeenAt(message.authorId),
  };
}
</script>

<template>
  <UCard :ui="{ root: 'flex flex-col flex-1 min-h-0', body: 'flex flex-col flex-1 min-h-0 p-0 sm:p-0' }">
    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6" @scroll="onScroll">
      <div v-if="hasOlder" class="flex justify-center pb-4">
        <UButton
          size="xs"
          color="neutral"
          variant="subtle"
          icon="i-lucide-chevron-up"
          :loading="loadingOlder"
          @click="requestOlder"
        >
          {{ t("tickets.detail.loadOlder", { shown: messages.length, total }) }}
        </UButton>
      </div>

      <p v-if="!messages.length" class="text-sm text-muted text-center py-10">
        {{ t("tickets.detail.noMessages") }}
      </p>

      <template v-for="entry in entries" :key="entry.key">
        <USeparator v-if="entry.kind === 'day'" :label="entry.label" class="my-4" size="xs" />

        <TicketMessageBubble
          v-else
          :entry="entry"
          :editing="editingId === entry.message.id"
          :can-edit="canEdit(entry.message)"
          :seen="seenBy(entry.message)"
          :format-date-time="formatDateTime"
          @quote="(author, body) => emit('quote', author, body)"
          @edit="startEdit($event)"
          @presence="openPresence($event)"
          @seen="seenReaders = $event"
        >
          <template v-if="editingId === entry.message.id" #editor>
            <TicketMessageEditBox
              v-model="editDraft"
              :expired="expired"
              :remaining-label="remainingLabel"
              :saving="savingEdit"
              @cancel="cancelEdit"
              @save="saveEdit(entry.message.id)"
            />
          </template>
        </TicketMessageBubble>
      </template>

      <TicketSeenModal :open="seenReaders !== null" :readers="seenReaders ?? []" @close="seenReaders = null" />
      <PresenceModal
        v-if="presenceTarget"
        :open="true"
        :name="presenceTarget.name"
        :avatar-url="presenceTarget.avatarUrl"
        :online="presenceTarget.online"
        :last-seen-at="presenceTarget.lastSeenAt"
        @close="presenceTarget = null"
      />

      <p v-if="typingBy" class="flex items-center gap-2 text-xs text-muted pt-2">
        <span class="flex gap-0.5">
          <span
            v-for="dot in 3"
            :key="dot"
            class="size-1.5 rounded-full bg-muted animate-bounce"
            :style="{ animationDelay: `${dot * 120}ms` }"
          />
        </span>
        {{ t("tickets.detail.typing", { who: typingBy.who }) }}
      </p>
    </div>

    <div v-if="$slots.composer" class="border-t border-default">
      <slot name="composer" />
    </div>
  </UCard>
</template>
