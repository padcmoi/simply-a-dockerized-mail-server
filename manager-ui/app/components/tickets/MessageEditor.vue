<script setup lang="ts">
// The one rich message editor of the support desk: opening a ticket, replying
// to one, and editing a sent message all go through it. It owns the TipTap
// surface and the toolbar; the caller supplies the footer actions (send, or
// cancel/save) through the `footer` slot, and asks for the framed box wherever
// the editor stands on its own rather than flush inside a card.
//
// The typing area opens on three lines wherever it is used: a reply box one line
// tall reads as a chat input, and a support message is a paragraph. It grows
// from there up to `max-h-60`, then scrolls.
const emit = defineEmits<{ typing: [] }>();
const model = defineModel<string>({ required: true });
defineProps<{ framed?: boolean; baseClass?: string }>();

const { t } = useI18n();
const slots = useSlots();

// Only the slice of the TipTap editor this component drives; the package is a
// transitive dependency of @nuxt/ui, not a direct one to import types from.
// UEditor exposes its instance rather than emitting it: it overrides the tiptap
// `onCreate` it receives, so a listener on that event is never called.
const surface = useTemplateRef<{ editor: { commands: { focus: (_at: "end") => boolean } } | null }>("surface");

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

defineExpose({
  focusEnd: async () => {
    await nextTick();
    surface.value?.editor?.commands.focus("end");
  },
});
</script>

<template>
  <div :class="framed && 'rounded-lg overflow-hidden ring ring-inset ring-accented bg-default'">
    <UEditor
      ref="surface"
      v-model="model"
      content-type="markdown"
      :image="false"
      :mention="false"
      :ui="{ base: baseClass, content: 'min-h-24 max-h-60 overflow-y-auto px-4 py-2.5 sm:px-6 focus:outline-none' }"
      class="w-full divide-y divide-default"
      @update:model-value="emit('typing')"
    >
      <template #default="{ editor: current }">
        <UEditorToolbar :editor="current" :items="toolbar" class="flex-wrap px-3 py-1.5 sm:px-5 bg-elevated/50" />
      </template>
    </UEditor>

    <div v-if="slots.footer" class="px-4 py-2 sm:px-6 border-t border-default">
      <slot name="footer" />
    </div>
  </div>
</template>
