<script setup lang="ts">
// One message of the thread: the avatar that opens presence, the name when the
// bubble leads its run, the body a click can quote or edit, and the trailing
// line of marks. While this message is the one being edited, the editor slot
// replaces the body.
const emit = defineEmits<{
  quote: [author: string, body: string];
  edit: [message: TicketMessage];
  presence: [message: TicketMessage];
  seen: [readers: TicketReader[]];
}>();

const props = defineProps<{
  entry: ThreadBubble<TicketMessage>;
  editing: boolean;
  canEdit: boolean;
  seen: TicketReader[];
  formatDateTime: (_iso: string) => string;
}>();

const { t } = useI18n();
const { isOnline, lastSeenAt } = usePresence();

const message = computed(() => props.entry.message);
const author = computed(() => message.value.authorName ?? message.value.authorEmail ?? t("tickets.detail.unknown"));
const editedLabel = computed(() =>
  message.value.editCount > 1 ? t("tickets.detail.editedTimes", { count: message.value.editCount }) : t("tickets.detail.edited")
);
const editedTitle = computed(() =>
  message.value.updatedAt ? t("tickets.detail.editedAt", { at: props.formatDateTime(message.value.updatedAt) }) : undefined
);
const clickable = computed(() => !props.editing && (props.entry.mine ? props.canEdit : true));
const bubbleTitle = computed(() =>
  props.entry.mine ? (props.canEdit ? t("tickets.detail.editHint") : undefined) : t("tickets.detail.quoteHint")
);

// A plain click on someone else's message quotes it; on one's own it opens the
// editor while still within the edit window. A click that ends a text selection,
// or one landing on a link, does neither, so copying an excerpt still works.
function onClick(event: MouseEvent) {
  if (props.editing) return;
  if ((event.target as HTMLElement).closest("a")) return;
  if (window.getSelection()?.toString()) return;
  if (props.entry.mine) {
    if (props.canEdit) emit("edit", message.value);
    return;
  }
  emit("quote", author.value, message.value.body);
}
</script>

<template>
  <div
    class="flex items-start gap-2.5"
    :class="[entry.mine ? 'flex-row-reverse' : 'flex-row', entry.trailing ? 'mb-3' : 'mb-0.5']"
  >
    <button
      v-if="entry.leading"
      type="button"
      class="shrink-0 -mt-0.5 rounded-full cursor-pointer"
      :aria-label="author"
      @click="emit('presence', message)"
    >
      <PresenceAvatar
        :src="message.authorAvatarUrl"
        :alt="author"
        :online="message.authorId ? isOnline(message.authorId) : undefined"
        :last-seen-at="lastSeenAt(message.authorId)"
        size="sm"
      />
    </button>
    <div v-else class="w-8 shrink-0" />

    <div
      class="flex flex-col min-w-[50%]"
      :class="[entry.mine ? 'items-end' : 'items-start', editing ? 'max-w-full w-full' : 'max-w-[75%]']"
    >
      <p v-if="entry.leading" class="text-xs text-muted px-1 pb-1 truncate max-w-full">
        {{ entry.mine ? t("tickets.detail.you") : author }}
      </p>

      <slot name="editor">
        <div
          class="w-full px-3.5 py-2 text-sm rounded-2xl"
          :title="bubbleTitle"
          :class="[
            clickable ? 'cursor-pointer' : '',
            entry.mine
              ? 'bg-primary/10 text-default ring ring-inset ring-primary/25'
              : 'bg-elevated text-default ring ring-inset ring-default',
            entry.leading && (entry.mine ? 'rounded-tr-md' : 'rounded-tl-md'),
          ]"
          @click="onClick"
        >
          <MessageBody :text="message.body" />
        </div>
      </slot>

      <p v-if="entry.trailing" class="flex items-center gap-1 text-[11px] text-dimmed px-1 pt-1">
        <span v-if="message.editCount > 0" class="italic" :title="editedTitle">{{ editedLabel }}</span>
        <span v-if="message.editCount > 0" aria-hidden="true">·</span>
        <span>{{ entry.at }}</span>
        <button
          v-if="entry.mine && canEdit && !editing"
          type="button"
          class="inline-flex cursor-pointer hover:text-default"
          :aria-label="t('tickets.detail.editMessage')"
          @click="emit('edit', message)"
        >
          <UIcon name="i-lucide-pencil" class="size-3" />
        </button>
        <button
          v-if="entry.mine"
          type="button"
          class="inline-flex cursor-pointer"
          :aria-label="seen.length ? t('tickets.detail.seen') : t('tickets.detail.sent')"
          @click="emit('seen', seen)"
        >
          <UIcon
            :name="seen.length ? 'i-lucide-check-check' : 'i-lucide-check'"
            :class="seen.length ? 'text-success size-3.5' : 'size-3.5'"
          />
        </button>
      </p>
    </div>
  </div>
</template>
