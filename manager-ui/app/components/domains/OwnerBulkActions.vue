<script setup lang="ts">
const emit = defineEmits<{ done: [keys: (string | number)[]] }>();
const props = defineProps<{
  kind: "recipients" | "aliases";
  domainId: number;
  keys: (string | number)[];
  canAssign: boolean;
  canUnassign: boolean;
}>();

const { t } = useI18n();
const { call } = useApi();
const { running, run } = useBulkRun();
const { options, searchTerm, loading, search } = useAccountOptions();

const open = ref(false);
const picked = ref<AccountOption | undefined>(undefined);

function endpoint(id: string | number) {
  return `/domains/${props.domainId}/${props.kind}/${id}/owner`;
}

function openAssign() {
  picked.value = undefined;
  open.value = true;
  void search("");
}

function closeAssign() {
  open.value = false;
}

async function assign() {
  const account = picked.value;
  if (!account) return;
  open.value = false;
  const done = await run(
    props.keys,
    (id) => call(endpoint(id), { method: "PUT", body: { ownerId: account.value } }),
    (count) => t("mailboxOwner.bulk.assigned", { count, account: account.label })
  );
  emit("done", done);
}

async function detach() {
  const done = await run(
    props.keys,
    (id) => call(endpoint(id), { method: "DELETE" }),
    (count) => t("mailboxOwner.bulk.detached", { count })
  );
  emit("done", done);
}
</script>

<template>
  <UButton
    v-if="canAssign"
    icon="i-lucide-user-plus"
    color="primary"
    variant="soft"
    size="sm"
    :loading="running"
    @click="openAssign"
  >
    {{ t("mailboxOwner.bulk.assign") }}
  </UButton>
  <UButton
    v-if="canUnassign"
    icon="i-lucide-user-minus"
    color="neutral"
    variant="soft"
    size="sm"
    :loading="running"
    @click="detach"
  >
    {{ t("mailboxOwner.detach") }}
  </UButton>

  <UModal
    v-model:open="open"
    :title="t('mailboxOwner.bulk.title', { count: keys.length })"
    :description="t('mailboxOwner.bulk.hint')"
  >
    <template #body>
      <UFormField :label="t('mailboxOwner.pickAccount')">
        <USelectMenu
          v-model="picked"
          v-model:search-term="searchTerm"
          :items="options"
          :loading="loading"
          icon="i-lucide-user-plus"
          :placeholder="t('mailboxOwner.pickAccount')"
          class="w-full"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="closeAssign">{{ t("common.cancel") }}</UButton>
        <UButton color="primary" icon="i-lucide-check" :disabled="!picked" @click="assign">
          {{ t("mailboxOwner.attach") }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
