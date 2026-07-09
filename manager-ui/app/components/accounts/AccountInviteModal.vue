<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  submit: [{ email: string; groupId: string | null }];
}>();

const props = defineProps<{
  open: boolean;
  groupOptions: { label: string; value: string }[];
  sending: boolean;
}>();

const email = ref("");
const selectedGroup = ref<string | undefined>(undefined);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) {
      email.value = "";
      selectedGroup.value = undefined;
    }
  }
);

function onSubmit() {
  emit("submit", {
    email: email.value,
    groupId: selectedGroup.value ?? null,
  });
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("accounts.invite.title") }}</h3>
        </template>

        <UFormField :label="t('accounts.invite.emailLabel')" required>
          <UInput v-model="email" type="email" class="w-full" />
        </UFormField>

        <UFormField :label="t('accounts.invite.groupLabel')" :hint="t('accounts.invite.groupHint')" class="mt-4">
          <USelectMenu
            v-model="selectedGroup"
            value-key="value"
            :items="groupOptions"
            :placeholder="t('accounts.invite.groupPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="sending" :disabled="!email" @click="onSubmit">
              {{ t("accounts.invite.submit") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
