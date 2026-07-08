<script setup lang="ts">
import type { ApiTokenItem } from "~/composables/useApiTokens";

const emit = defineEmits<{
  "update:open": [boolean];
  submit: [{ name: string; allowedIps?: string[]; expiresAt?: string }];
}>();

const props = defineProps<{
  open: boolean;
  token?: ApiTokenItem;
  saving: boolean;
}>();

const name = ref("");
const ipsRaw = ref("");
const expiresAt = ref("");

const parsedIps = computed(() =>
  ipsRaw.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) {
      name.value = "";
      ipsRaw.value = "";
      expiresAt.value = "";
    } else if (props.token) {
      name.value = props.token.name;
      ipsRaw.value = props.token.allowedIps?.join(", ") ?? "";
      expiresAt.value = props.token.expiresAt ? props.token.expiresAt.slice(0, 10) : "";
    }
  }
);

function onSubmit() {
  emit("submit", {
    name: name.value.trim(),
    allowedIps: parsedIps.value.length ? parsedIps.value : undefined,
    expiresAt: expiresAt.value ? new Date(expiresAt.value).toISOString() : undefined,
  });
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            {{ token ? t("apiTokens.modal.editTitle") : t("apiTokens.modal.createTitle") }}
          </h3>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('apiTokens.modal.name')" required>
            <UInput v-model="name" class="w-full" :placeholder="t('apiTokens.modal.namePlaceholder')" />
          </UFormField>

          <UFormField :label="t('apiTokens.modal.allowedIps')" :hint="t('apiTokens.modal.allowedIpsHint')">
            <UInput v-model="ipsRaw" class="w-full" placeholder="1.2.3.4, 10.0.0.1" />
          </UFormField>

          <UFormField :label="t('apiTokens.modal.expiresAt')" :hint="t('apiTokens.modal.expiresAtHint')">
            <UInput v-model="expiresAt" type="date" class="w-full" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!name.trim()" @click="onSubmit">
              {{ token ? t("common.save") : t("common.create") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
