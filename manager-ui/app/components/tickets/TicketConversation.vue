<script setup lang="ts">
const emit = defineEmits<{ loadOlder: [] }>();

const props = defineProps<{
  messages: TicketMessage[];
  total: number;
  hasOlder: boolean;
  loadingOlder: boolean;
  isMine: (_message: TicketMessage) => boolean;
}>();

const { t, locale } = useI18n();

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const scroller = useTemplateRef<HTMLElement>("scroller");
const stickToBottom = ref(true);

const intlLocale = computed(() => locale.value.split("_")[0]);
const dayFormat = computed(() => new Intl.DateTimeFormat(intlLocale.value, { dateStyle: "full" }));
const timeFormat = computed(() => new Intl.DateTimeFormat(intlLocale.value, { timeStyle: "short" }));

interface Bubble {
  key: string;
  message: TicketMessage;
  mine: boolean;
  at: string;
  // First of a run from the same author: only that one carries the avatar and
  // the name, the followers stay bare so a burst reads as one block.
  leading: boolean;
  trailing: boolean;
}

type Entry = { kind: "day"; key: string; label: string } | ({ kind: "bubble" } & Bubble);

const entries = computed<Entry[]>(() => {
  const out: Entry[] = [];
  let day: string | null = null;

  props.messages.forEach((message, index) => {
    const previous = props.messages[index - 1];
    const next = props.messages[index + 1];
    const at = new Date(message.createdAt).getTime();
    const currentDay = dayKey(message.createdAt);

    if (currentDay !== day) {
      day = currentDay;
      out.push({ kind: "day", key: `day-${currentDay}`, label: dayFormat.value.format(new Date(message.createdAt)) });
    }

    function sameRun(other?: TicketMessage) {
      return (
        !!other &&
        other.authorEmail === message.authorEmail &&
        dayKey(other.createdAt) === currentDay &&
        Math.abs(new Date(other.createdAt).getTime() - at) < GROUP_WINDOW_MS
      );
    }

    out.push({
      kind: "bubble",
      key: `m-${message.id}`,
      message,
      mine: props.isMine(message),
      at: timeFormat.value.format(new Date(message.createdAt)),
      leading: !sameRun(previous),
      trailing: !sameRun(next),
    });
  });

  return out;
});

// Follow the conversation only when already reading its end: pulling an older
// page or scrolling up must not yank the view back down.
watch(
  () => props.messages.at(-1)?.id,
  async () => {
    if (!stickToBottom.value) return;
    await nextTick();
    const el = scroller.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
  { immediate: true }
);

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function authorLabel(message: TicketMessage) {
  return message.authorName ?? message.authorEmail ?? t("tickets.detail.unknown");
}

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <div ref="scroller" class="max-h-[60vh] min-h-40 overflow-y-auto px-4 py-4 sm:px-6" @scroll="onScroll">
      <div v-if="hasOlder" class="flex justify-center pb-4">
        <UButton
          size="xs"
          color="neutral"
          variant="subtle"
          icon="i-lucide-chevron-up"
          :loading="loadingOlder"
          @click="emit('loadOlder')"
        >
          {{ t("tickets.detail.loadOlder", { shown: messages.length, total }) }}
        </UButton>
      </div>

      <p v-if="!messages.length" class="text-sm text-muted text-center py-10">
        {{ t("tickets.detail.noMessages") }}
      </p>

      <template v-for="entry in entries" :key="entry.key">
        <USeparator v-if="entry.kind === 'day'" :label="entry.label" class="my-4" size="xs" />

        <div
          v-else
          class="flex gap-2.5"
          :class="[entry.mine ? 'flex-row-reverse' : 'flex-row', entry.trailing ? 'mb-3' : 'mb-0.5']"
        >
          <UAvatar
            v-if="entry.leading"
            :src="entry.message.authorAvatarUrl ?? undefined"
            :alt="authorLabel(entry.message)"
            size="sm"
            class="shrink-0 mt-4"
          />
          <div v-else class="w-8 shrink-0" />

          <div class="flex flex-col min-w-[50%] max-w-[75%]" :class="entry.mine ? 'items-end' : 'items-start'">
            <p v-if="entry.leading" class="text-xs text-muted px-1 pb-1 truncate max-w-full">
              {{ entry.mine ? t("tickets.detail.you") : authorLabel(entry.message) }}
            </p>

            <div
              class="w-full px-3.5 py-2 text-sm rounded-2xl"
              :class="[
                entry.mine
                  ? 'bg-primary/10 text-default ring ring-inset ring-primary/25'
                  : 'bg-elevated text-default ring ring-inset ring-default',
                entry.leading && (entry.mine ? 'rounded-tr-md' : 'rounded-tl-md'),
              ]"
            >
              <MessageBody :text="entry.message.body" />
            </div>

            <p v-if="entry.trailing" class="text-[11px] text-dimmed px-1 pt-1">{{ entry.at }}</p>
          </div>
        </div>
      </template>
    </div>
  </UCard>
</template>
