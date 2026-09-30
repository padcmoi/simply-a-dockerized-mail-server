<script setup lang="ts">
const emit = defineEmits<{ done: [keys: (string | number)[]] }>();
const props = defineProps<{ domainId: number; keys: (string | number)[] }>();

const { t } = useI18n();
const { call } = useApi();
const { running, run } = useBulkRun();

const confirmOpen = ref(false);

function askDelete() {
  confirmOpen.value = true;
}

async function remove() {
  const done = await run(
    props.keys,
    (id) => call(`/domains/${props.domainId}/aliases/${id}`, { method: "DELETE" }),
    (count) => t("aliases.bulk.deleted", { count })
  );
  emit("done", done);
}
</script>

<template>
  <UButton icon="i-lucide-trash-2" color="error" variant="soft" size="sm" :loading="running" @click="askDelete">
    {{ t("aliases.bulk.delete", { count: keys.length }) }}
  </UButton>

  <ConfirmModal
    v-model:open="confirmOpen"
    :title="t('aliases.bulk.deleteTitle', { count: keys.length })"
    :description="t('aliases.bulk.deleteDescription')"
    @confirm="remove"
  />
</template>
