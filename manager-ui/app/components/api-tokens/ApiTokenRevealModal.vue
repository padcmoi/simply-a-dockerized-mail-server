<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  dismissed: [];
}>();

const props = withDefaults(defineProps<{ open: boolean; token: CreatedToken | null; mode?: "created" | "stored" }>(), {
  mode: "created",
});

const copiedField = ref<string | null>(null);
const hasCopiedKey = ref(false);
const confirmed = ref(false);

const { t } = useI18n();
const toast = useToast();

watch(
  () => props.token,
  (newToken) => {
    if (newToken) {
      copiedField.value = null;
      hasCopiedKey.value = false;
      confirmed.value = false;
    }
  }
);

async function copyField(field: string, value: string) {
  await navigator.clipboard.writeText(value);
  copiedField.value = field;
  hasCopiedKey.value = field === "key";
  setTimeout(() => (copiedField.value = null), 2000);
}

function onConfirm() {
  confirmed.value = true;
  if (props.mode === "created") toast.add({ title: t("apiTokens.toast.keySaved"), color: "success" });
  emit("update:open", false);
}

function onModalClose(val: boolean) {
  if (!val && !confirmed.value && props.mode === "created") {
    emit("dismissed");
  }
  emit("update:open", val);
}
</script>

<template>
  <UModal :open="open" @update:open="onModalClose">
    <template #content>
      <UCard v-if="token">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-key" class="text-warning shrink-0" />
            <h3 class="font-semibold">{{ mode === "stored" ? t("apiTokens.secret.title") : t("apiTokens.reveal.title") }}</h3>
          </div>
        </template>

        <div class="space-y-4">
          <UAlert
            v-if="mode === 'created'"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="t('apiTokens.reveal.warning')"
          />
          <UAlert v-else color="neutral" variant="subtle" icon="i-lucide-shield" :title="t('apiTokens.secret.warning')" />

          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm text-muted shrink-0">{{ t("apiTokens.modal.name") }}</span>
            <span class="font-medium text-default truncate">{{ token.name }}</span>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <p class="text-sm text-muted">{{ t("apiTokens.reveal.keyLabel") }}</p>
              <UButton
                :icon="copiedField === 'key' ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copiedField === 'key' ? 'success' : 'neutral'"
                variant="ghost"
                size="xs"
                @click="copyField('key', token.key)"
                >{{ copiedField === "key" ? t("apiTokens.reveal.copied") : t("apiTokens.reveal.copy") }}</UButton
              >
            </div>
            <div class="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all select-all leading-relaxed">
              {{ token.key }}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <p class="text-sm text-muted">{{ t("apiTokens.table.clientId") }}</p>
              <UButton
                :icon="copiedField === 'clientId' ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copiedField === 'clientId' ? 'success' : 'neutral'"
                variant="ghost"
                size="xs"
                @click="copyField('clientId', token.clientId)"
                >{{ copiedField === "clientId" ? t("apiTokens.reveal.copied") : t("apiTokens.reveal.copy") }}</UButton
              >
            </div>
            <div class="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all select-all leading-relaxed">
              {{ token.clientId }}
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="primary" :disabled="mode === 'created' && !hasCopiedKey" @click="onConfirm">
              {{ mode === "stored" ? t("common.close") : t("apiTokens.reveal.done") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
