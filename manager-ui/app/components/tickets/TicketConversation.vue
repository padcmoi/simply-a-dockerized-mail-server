<script setup lang="ts">
const emit = defineEmits<{ loadOlder: [] }>();

const props = defineProps<{
  messages: TicketMessage[];
  total: number;
  hasOlder: boolean;
  loadingOlder: boolean;
  isMine: (_message: TicketMessage) => boolean;
  seenBy: (_message: TicketMessage) => TicketReader[];
  typingBy: { userId: string; who: string } | null;
}>();

const { t, locale } = useI18n();
const { isOnline } = usePresence();

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const scroller = useTemplateRef<HTMLElement>("scroller");
const stickToBottom = ref(true);
// Height captured the instant an older page is asked for, so the scroll can be
// put back on the same message once that page has actually rendered.
const anchorHeight = ref<number | null>(null);

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
  seen: TicketReader[];
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
      seen: props.seenBy(message),
    });
  });

  return out;
});

// Prepending shifts the whole thread down under the reader, which would also
// leave the view at the top and pull the next page straight away. Growing the
// scroll by exactly what was inserted keeps the same message under the eye.
watch(
  () => props.messages[0]?.id,
  async (first, previous) => {
    const el = scroller.value;
    const before = anchorHeight.value;
    anchorHeight.value = null;
    if (!el || before === null || previous === undefined || first === previous) return;
    await nextTick();
    el.scrollTop += el.scrollHeight - before;
  }
);

// A request that brings nothing back would otherwise leave a stale anchor,
// which the next incoming message would then wrongly apply.
watch(
  () => props.loadingOlder,
  (loading) => {
    if (!loading) anchorHeight.value = null;
  }
);

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

// The load is asynchronous, so the height is only recorded here; the watcher
// above re-anchors once the older page has actually rendered.
function requestOlder() {
  anchorHeight.value = scroller.value?.scrollHeight ?? null;
  emit("loadOlder");
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

        <div
          v-else
          class="flex items-start gap-2.5"
          :class="[entry.mine ? 'flex-row-reverse' : 'flex-row', entry.trailing ? 'mb-3' : 'mb-0.5']"
        >
          <PresenceAvatar
            v-if="entry.leading"
            :src="entry.message.authorAvatarUrl"
            :alt="authorLabel(entry.message)"
            :online="entry.message.authorId ? isOnline(entry.message.authorId) : undefined"
            size="sm"
            class="shrink-0 -mt-0.5"
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

            <p v-if="entry.trailing" class="flex items-center gap-1 text-[11px] text-dimmed px-1 pt-1">
              <span>{{ entry.at }}</span>
              <UIcon
                v-if="entry.mine"
                :name="entry.seen.length ? 'i-lucide-check-check' : 'i-lucide-check'"
                :class="entry.seen.length ? 'text-success size-3.5' : 'size-3.5'"
                :aria-label="entry.seen.length ? t('tickets.detail.seen') : t('tickets.detail.sent')"
              />
              <span v-if="entry.seen.length" class="sr-only">
                {{ t("tickets.detail.seenBy", { who: entry.seen.map((r) => r.name).join(", ") }) }}
              </span>
            </p>
          </div>
        </div>
      </template>

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
