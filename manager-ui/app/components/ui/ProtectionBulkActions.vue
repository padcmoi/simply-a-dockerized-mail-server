<script setup lang="ts" generic="T extends { id: string | number; isProtected: number }">
const emit = defineEmits<{ done: [] }>();
const props = defineProps<{
  type: ProtectableKind;
  rows: T[];
}>();

const { t } = useI18n();
const { canProtect, canUnprotect } = useProtectionRights(props.type);
const { call } = useApi();
const { running, run } = useBulkRun();

const confirmOpen = ref(false);
const unprotectedIds = computed(() => unprotectedKeys(props.rows));
const protectedIds = computed(() => props.rows.filter((row) => row.isProtected === 1).map((row) => row.id));

function askProtect() {
  confirmOpen.value = true;
}

async function protect() {
  await run(
    unprotectedIds.value,
    (id) => call(`/protection/${props.type}/${id}`, { method: "PUT" }),
    (count) => t("protection.bulk.protected", { count })
  );
  emit("done");
}

async function unprotect() {
  await run(
    protectedIds.value,
    (id) => call(`/protection/${props.type}/${id}`, { method: "DELETE" }),
    (count) => t("protection.bulk.unprotected", { count })
  );
  emit("done");
}
</script>

<template>
  <UButton
    v-if="canProtect && unprotectedIds.length"
    icon="i-lucide-shield"
    color="neutral"
    variant="soft"
    size="sm"
    :loading="running"
    @click="askProtect"
  >
    {{ t("protection.bulk.protect", { count: unprotectedIds.length }) }}
  </UButton>
  <UButton
    v-if="canUnprotect && protectedIds.length"
    icon="i-lucide-shield-off"
    color="neutral"
    variant="soft"
    size="sm"
    :loading="running"
    @click="unprotect"
  >
    {{ t("protection.bulk.unprotect", { count: protectedIds.length }) }}
  </UButton>

  <ConfirmModal
    v-model:open="confirmOpen"
    type="warning"
    :title="t('protection.bulk.confirmTitle', { count: unprotectedIds.length })"
    :description="t('protection.confirmDescription')"
    @confirm="protect"
  />
</template>
