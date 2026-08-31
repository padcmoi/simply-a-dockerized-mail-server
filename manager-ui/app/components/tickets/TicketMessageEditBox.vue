<script setup lang="ts">
// The in-place editor of an existing message: the shared rich editor plus a
// footer that counts down the remaining edit window and carries cancel/save.
const emit = defineEmits<{ cancel: []; save: [] }>();
const model = defineModel<string>({ required: true });
defineProps<{ expired: boolean; remainingLabel: string; saving: boolean }>();

const { t } = useI18n();
</script>

<template>
  <div class="w-full text-sm" @keydown.esc="emit('cancel')">
    <MessageEditor v-model="model" framed>
      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] tabular-nums" :class="expired ? 'text-error' : 'text-warning'">
            <UIcon name="i-lucide-timer" class="size-3 -mt-0.5 mr-0.5 inline-block" />
            {{ expired ? t("tickets.detail.editExpired") : t("tickets.detail.editableFor", { time: remainingLabel }) }}
          </span>
          <div class="flex gap-2">
            <UButton size="xs" color="neutral" variant="ghost" @click="emit('cancel')">
              {{ t("tickets.detail.cancelEdit") }}
            </UButton>
            <UButton size="xs" color="primary" :loading="saving" :disabled="!model.trim() || expired" @click="emit('save')">
              {{ t("tickets.detail.saveEdit") }}
            </UButton>
          </div>
        </div>
      </template>
    </MessageEditor>
  </div>
</template>
