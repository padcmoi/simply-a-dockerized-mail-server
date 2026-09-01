<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    autocomplete?: string;
    placeholder?: string;
    icon?: string;
    required?: boolean;
    disabled?: boolean;
  }>(),
  { autocomplete: "current-password", placeholder: undefined, icon: undefined, required: false, disabled: false }
);

const model = defineModel<string>({ default: "" });

const { t } = useI18n();
const show = ref(false);

function toggle() {
  show.value = !show.value;
}
</script>

<template>
  <UInput
    v-model="model"
    :type="show ? 'text' : 'password'"
    :autocomplete="props.autocomplete"
    :placeholder="props.placeholder"
    :icon="props.icon"
    :required="props.required"
    :disabled="props.disabled"
    :ui="{ trailing: 'pe-1' }"
  >
    <template #trailing>
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="show ? t('common.hidePassword') : t('common.showPassword')"
        :aria-pressed="show"
        :disabled="props.disabled"
        @click="toggle"
      />
    </template>
  </UInput>
</template>
