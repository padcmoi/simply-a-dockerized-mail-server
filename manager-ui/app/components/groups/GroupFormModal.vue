<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  submit: [{ name: string; description?: string | null; isDefault?: boolean }];
}>();

const props = defineProps<{
  open: boolean;
  saving: boolean;
}>();

const name = ref("");
const description = ref("");
const isDefault = ref(false);

const { t } = useI18n();

watch(
  () => props.open,
  (v) => {
    if (!v) {
      name.value = "";
      description.value = "";
      isDefault.value = false;
    }
  }
);

function onSubmit() {
  emit("submit", {
    name: name.value.trim(),
    description: description.value.trim() || null,
    isDefault: isDefault.value,
  });
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("groups.form.title") }}</h3>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('groups.form.name')" required>
            <UInput v-model="name" class="w-full" />
          </UFormField>
          <UFormField :label="t('groups.form.description')">
            <UTextarea v-model="description" class="w-full" :rows="3" />
          </UFormField>
          <UCheckbox
            v-model="isDefault"
            variant="card"
            :ui="{ root: 'border-0 rounded-none p-0' }"
            :label="t('groups.form.isDefault')"
            :description="t('groups.form.isDefaultHint')"
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!name.trim()" @click="onSubmit">
              {{ t("groups.form.submit") }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
