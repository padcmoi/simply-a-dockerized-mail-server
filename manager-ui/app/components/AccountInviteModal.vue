<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  submit: [{ email: string; domainIds: number[] | null }];
}>();

const props = defineProps<{
  open: boolean;
  domainOptions: { label: string; value: number }[];
  sending: boolean;
}>();

const email = ref("");
const selectedDomains = ref<number[]>([]);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) {
      email.value = "";
      selectedDomains.value = [];
    }
  }
);

function toggle(value: number, checked: boolean) {
  selectedDomains.value = checked ? [...selectedDomains.value, value] : selectedDomains.value.filter((id) => id !== value);
}

function onSubmit() {
  emit("submit", {
    email: email.value,
    domainIds: selectedDomains.value.length ? selectedDomains.value : null,
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

        <UFormField :label="t('accounts.invite.domainsLabel')" :hint="t('accounts.invite.domainsHint')" class="mt-4">
          <div class="space-y-2 max-h-48 overflow-y-auto border border-default rounded-md p-2">
            <label v-for="opt in domainOptions" :key="opt.value" class="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                :value="opt.value"
                :checked="selectedDomains.includes(opt.value)"
                class="rounded"
                @change="(e) => toggle(opt.value, (e.target as HTMLInputElement).checked)"
              />
              <span class="text-sm">{{ opt.label }}</span>
            </label>
          </div>
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
