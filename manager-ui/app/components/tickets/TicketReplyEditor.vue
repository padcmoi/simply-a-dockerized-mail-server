<script setup lang="ts">
const emit = defineEmits<{ send: [body: string]; typing: [] }>();

defineProps<{ sending: boolean }>();

const { t } = useI18n();

const body = ref("");
// Kept so a quote can move the caret under the inserted block; TipTap owns the
// selection, setting the model alone would leave the cursor wherever it was.
// Only the slice of the TipTap editor this component drives; the package is a
// transitive dependency of @nuxt/ui, not a direct one to import types from.
const editor = shallowRef<{ commands: { focus: (_at: "end") => boolean } } | null>(null);

const empty = computed(() => body.value.trim().length === 0);

// UEditorToolbar renders strictly what `items` declares: with no list it draws
// nothing at all. Grouped by intent, each group separated in the bar.
const toolbar = computed(() => [
  [
    { kind: "undo" as const, icon: "i-lucide-undo-2", "aria-label": t("tickets.editor.undo") },
    { kind: "redo" as const, icon: "i-lucide-redo-2", "aria-label": t("tickets.editor.redo") },
  ],
  [
    { kind: "mark" as const, mark: "bold" as const, icon: "i-lucide-bold", "aria-label": t("tickets.editor.bold") },
    { kind: "mark" as const, mark: "italic" as const, icon: "i-lucide-italic", "aria-label": t("tickets.editor.italic") },
    { kind: "mark" as const, mark: "strike" as const, icon: "i-lucide-strikethrough", "aria-label": t("tickets.editor.strike") },
    { kind: "mark" as const, mark: "code" as const, icon: "i-lucide-code", "aria-label": t("tickets.editor.code") },
  ],
  [
    { kind: "bulletList" as const, icon: "i-lucide-list", "aria-label": t("tickets.editor.bulletList") },
    { kind: "orderedList" as const, icon: "i-lucide-list-ordered", "aria-label": t("tickets.editor.orderedList") },
    { kind: "blockquote" as const, icon: "i-lucide-quote", "aria-label": t("tickets.editor.quote") },
    { kind: "codeBlock" as const, icon: "i-lucide-square-code", "aria-label": t("tickets.editor.codeBlock") },
  ],
  [
    { kind: "link" as const, icon: "i-lucide-link", "aria-label": t("tickets.editor.link") },
    { kind: "clearFormatting" as const, icon: "i-lucide-remove-formatting", "aria-label": t("tickets.editor.clear") },
  ],
]);

function submit() {
  if (empty.value) return;
  emit("send", body.value);
}

defineExpose({
  clear: () => {
    body.value = "";
  },
  quote: async (author: string, text: string) => {
    body.value = `${buildQuote(author, text)}${body.value}`;
    await nextTick();
    editor.value?.commands.focus("end");
  },
});
</script>

<template>
  <div>
    <UEditor
      v-model="body"
      content-type="markdown"
      :placeholder="t('tickets.detail.replyPlaceholder')"
      :image="false"
      :mention="false"
      :ui="{ content: 'max-h-60 overflow-y-auto px-4 py-2.5 sm:px-6 focus:outline-none' }"
      class="w-full divide-y divide-default"
      @create="({ editor: created }) => (editor = created)"
      @update:model-value="emit('typing')"
    >
      <template #default="{ editor: current }">
        <UEditorToolbar :editor="current" :items="toolbar" class="px-3 py-1.5 sm:px-5 bg-elevated/50" />
      </template>
    </UEditor>

    <div class="flex justify-end px-4 py-2 sm:px-6 border-t border-default">
      <UButton icon="i-lucide-send" :disabled="empty" :loading="sending" @click="submit">
        {{ t("tickets.detail.send") }}
      </UButton>
    </div>
  </div>
</template>
