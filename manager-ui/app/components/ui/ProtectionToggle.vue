<script setup lang="ts">
const emit = defineEmits<{ changed: [] }>();
const props = defineProps<{
  type: ProtectableKind;
  id: string | number;
  label: string;
  protected: boolean;
}>();

const { t } = useI18n();
const { canProtect, canUnprotect } = useProtectionRights(props.type);
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const toast = useToast();

const confirmOpen = ref(false);
const saving = ref(false);

function askProtect() {
  confirmOpen.value = true;
}

async function protect() {
  await set(true);
}

async function unprotect() {
  await set(false);
}

async function set(value: boolean) {
  saving.value = true;
  try {
    await call(`/protection/${props.type}/${props.id}`, { method: value ? "PUT" : "DELETE" });
    toast.add({
      title: t(value ? "protection.protectedToast" : "protection.unprotectedToast", { label: props.label }),
      color: "success",
      icon: "i-lucide-check",
    });
    emit("changed");
  } catch (err) {
    toast.add({ title: t("protection.failed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UButton
    v-if="!props.protected && canProtect"
    icon="i-lucide-shield"
    color="neutral"
    variant="ghost"
    size="xs"
    square
    :loading="saving"
    :title="t('protection.protect')"
    :aria-label="t('protection.protect')"
    @click="askProtect"
  />
  <UButton
    v-else-if="props.protected && canUnprotect"
    icon="i-lucide-shield-check"
    color="success"
    variant="ghost"
    size="xs"
    square
    :loading="saving"
    :title="t('protection.unprotect')"
    :aria-label="t('protection.unprotect')"
    @click="unprotect"
  />
  <FullTooltip v-else-if="props.protected" :text="t('protection.protected')">
    <UIcon name="i-lucide-shield-check" class="size-4 text-success" />
  </FullTooltip>

  <ConfirmModal
    v-model:open="confirmOpen"
    type="warning"
    :title="t('protection.confirmTitle', { label })"
    :description="t('protection.confirmDescription')"
    @confirm="protect"
  />
</template>
