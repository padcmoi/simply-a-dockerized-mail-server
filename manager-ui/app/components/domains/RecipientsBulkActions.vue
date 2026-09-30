<script setup lang="ts">
const emit = defineEmits<{ done: [keys: (string | number)[]] }>();
const props = defineProps<{ domainId: number; keys: (string | number)[]; canEdit: boolean; canDelete: boolean }>();

const { t } = useI18n();
const { call } = useApi();
const { running, run } = useBulkRun();

const confirmOpen = ref(false);

async function setActive(active: boolean) {
  const done = await run(
    props.keys,
    (id) => call(`/domains/${props.domainId}/recipients/${id}`, { method: "PATCH", body: { active } }),
    (count) => t(active ? "recipients.bulk.activated" : "recipients.bulk.deactivated", { count })
  );
  emit("done", done);
}

function askDelete() {
  confirmOpen.value = true;
}

async function remove() {
  const done = await run(
    props.keys,
    (id) => call(`/domains/${props.domainId}/recipients/${id}`, { method: "DELETE" }),
    (count) => t("recipients.bulk.deleted", { count })
  );
  emit("done", done);
}
</script>

<template>
  <template v-if="canEdit">
    <UButton icon="i-lucide-circle-check" color="success" variant="soft" size="sm" :loading="running" @click="setActive(true)">
      {{ t("recipients.bulk.activate") }}
    </UButton>
    <UButton icon="i-lucide-circle-off" color="neutral" variant="soft" size="sm" :loading="running" @click="setActive(false)">
      {{ t("recipients.bulk.deactivate") }}
    </UButton>
  </template>
  <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="soft" size="sm" :loading="running" @click="askDelete">
    {{ t("recipients.bulk.delete", { count: keys.length }) }}
  </UButton>

  <ConfirmModal
    v-model:open="confirmOpen"
    :title="t('recipients.bulk.deleteTitle', { count: keys.length })"
    :description="t('recipients.bulk.deleteDescription')"
    @confirm="remove"
  />
</template>
