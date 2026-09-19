<script setup lang="ts">
const emit = defineEmits<{ older: [] }>();

const { lines, hasOlder, loadingOlder } = defineProps<{ lines: string[]; hasOlder: boolean; loadingOlder: boolean }>();

const { t } = useI18n();

const box = useTemplateRef<HTMLElement>("box");

const ERROR = /\b(error|fatal|panic|critical)\b/i;
const WARNING = /\b(warning|warn|reject|rejected|deferred|bounced|failed|timeout)\b/i;
const EDGE = 80;

let stick = true;
let anchor: { height: number; top: number } | null = null;

watch(
  () => lines,
  async () => {
    await nextTick();
    const element = box.value;
    if (!element) return;
    if (anchor) {
      element.scrollTop = anchor.top + element.scrollHeight - anchor.height;
      anchor = null;
    } else if (stick) {
      element.scrollTop = element.scrollHeight;
    }
  },
  { immediate: true }
);

watch(
  () => loadingOlder,
  (busy) => {
    if (!busy) void nextTick(() => (anchor = null));
  }
);

function older() {
  const element = box.value;
  if (!element || !hasOlder || loadingOlder || anchor) return;
  anchor = { height: element.scrollHeight, top: element.scrollTop };
  emit("older");
}

function onScroll() {
  const element = box.value;
  if (!element) return;
  stick = element.scrollHeight - element.scrollTop - element.clientHeight < EDGE;
  if (element.scrollTop < EDGE) older();
}

function selectAll(event: KeyboardEvent) {
  if (!box.value) return;
  event.preventDefault();
  const range = document.createRange();
  range.selectNodeContents(box.value);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function tone(line: string) {
  if (ERROR.test(line)) return "text-error";
  if (WARNING.test(line)) return "text-warning";
  return "text-default";
}
</script>

<template>
  <div
    ref="box"
    tabindex="0"
    class="min-h-0 flex-1 overflow-auto select-text focus:outline-none rounded-md border border-default bg-muted/40 p-3 font-mono text-xs leading-5"
    @scroll.passive="onScroll"
    @keydown.ctrl.a="selectAll"
    @keydown.meta.a="selectAll"
  >
    <div class="mb-2 flex justify-center select-none">
      <UButton
        v-if="hasOlder"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-up"
        :loading="loadingOlder"
        :label="t('mailLogs.older')"
        @click="older"
      />
      <span v-else class="text-dimmed">{{ t("mailLogs.beginning") }}</span>
    </div>
    <p v-if="!lines.length" class="text-dimmed">{{ t("mailLogs.empty") }}</p>
    <div v-for="(line, index) in lines" :key="index" class="whitespace-pre-wrap break-all" :class="tone(line)">{{ line }}</div>
  </div>
</template>
