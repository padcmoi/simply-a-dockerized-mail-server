<script setup lang="ts">
const emit = defineEmits<{ send: [body: string]; typing: [] }>();

defineProps<{ sending: boolean }>();

const { t } = useI18n();

const body = ref("");
const editor = useTemplateRef<{ focusEnd: () => Promise<void> }>("editor");

const empty = computed(() => body.value.trim().length === 0);

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
    await editor.value?.focusEnd();
  },
});
</script>

<template>
  <MessageEditor ref="editor" v-model="body" :placeholder="t('tickets.detail.replyPlaceholder')" @typing="emit('typing')">
    <template #footer>
      <div class="flex justify-end">
        <UButton icon="i-lucide-send" :disabled="empty" :loading="sending" @click="submit">
          {{ t("tickets.detail.send") }}
        </UButton>
      </div>
    </template>
  </MessageEditor>
</template>
