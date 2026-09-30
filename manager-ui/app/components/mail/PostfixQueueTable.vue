<script setup lang="ts">
const emit = defineEmits<{ purged: [] }>();
const props = defineProps<{ listing: PostfixQueueMessages | null; loading: boolean }>();

const { t } = useI18n();
const { formatDateTime, timeAgo } = useDateTime();
const { canPurge, confirmOpen, confirmTitle, confirmDescription, purging, ask, purge } = usePostfixPurge(
  () => props.listing?.queue,
  () => emit("purged")
);

const page = ref(1);
const selected = ref<(string | number)[]>([]);
const withReason = computed(() => props.listing?.queue === "deferred" || props.listing?.queue === "hold");

const columns = computed<DataTableColumn<QueueMessage>[]>(() => [
  { key: "arrival", label: t("postfixPage.col.arrival"), value: (row) => row.arrivalTime },
  {
    key: "sender",
    label: t("postfixPage.col.sender"),
    value: senderOf,
    primary: true,
  },
  {
    key: "recipients",
    label: t("postfixPage.col.recipients"),
    value: recipientsOf,
  },
  { key: "size", label: t("postfixPage.col.size"), value: (row) => row.size, searchable: false },
  { key: "id", label: t("postfixPage.col.id"), value: (row) => row.id },
  ...(withReason.value
    ? [{ key: "reason", label: t("postfixPage.col.reason"), value: (row: QueueMessage) => reasonsOf(row).join(" | ") }]
    : []),
]);

watch(
  () => props.listing?.queue,
  () => {
    page.value = 1;
    selected.value = [];
  }
);

async function confirmPurge() {
  const done = new Set<string | number>(await purge());
  selected.value = selected.value.filter((key) => !done.has(key));
}

function senderOf(row: QueueMessage) {
  return row.sender || t("postfixPage.nullSender");
}

function recipientsOf(row: QueueMessage) {
  return row.recipients.map((r) => r.address).join(", ");
}

function reasonsOf(row: QueueMessage) {
  return row.recipients.filter((r) => r.reason).map((r) => `${r.address}: ${r.status ? `${r.status} ` : ""}${r.reason}`);
}
</script>

<template>
  <div class="space-y-3 min-w-0">
    <UAlert
      v-if="listing && !listing.available"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="t('domainDashboard.postfix.unavailable')"
    />

    <template v-else>
      <p v-if="listing && listing.total > listing.limit" class="text-sm text-muted">
        {{ t("postfixPage.truncated", { limit: listing.limit, total: listing.total }) }}
      </p>

      <div v-if="!listing" class="space-y-2">
        <USkeleton v-for="i in 4" :key="i" class="h-8 w-full" />
      </div>

      <DataTable
        v-else
        v-model:page="page"
        v-model:selected="selected"
        table-id="postfix-queue-messages"
        :multiple="canPurge"
        :data="listing.messages"
        :columns="columns"
        :loading="loading"
        :row-key="(row: QueueMessage) => row.id"
        :empty-label="t('postfixPage.empty')"
      >
        <template #arrival="{ row }">
          <FullTooltip :text="formatDateTime(row.arrivalTime)">
            <span class="whitespace-nowrap">{{ timeAgo(row.arrivalTime) }}</span>
          </FullTooltip>
        </template>
        <template #sender="{ row }">
          <FullTooltip :text="senderOf(row)">
            <span :class="row.sender ? '' : 'text-muted italic'">{{ truncateChars(senderOf(row), 26) }}</span>
          </FullTooltip>
        </template>
        <template #recipients="{ row }">
          <FullTooltip :text="recipientsOf(row)">
            <span class="whitespace-nowrap">
              {{ truncateChars(row.recipients[0]?.address, 26) }}
              <span v-if="row.recipients.length > 1" class="text-muted">+{{ row.recipients.length - 1 }}</span>
            </span>
          </FullTooltip>
        </template>
        <template #reason="{ row }">
          <PostfixReasonCell :message-id="row.id" :recipients="row.recipients" />
        </template>
        <template #size="{ row }">
          <span class="whitespace-nowrap">{{ formatBytes(row.size) }}</span>
        </template>
        <template #id="{ row }">
          <span class="font-mono text-xs">{{ row.id }}</span>
        </template>
        <template #selection="{ keys }">
          <UButton icon="i-lucide-trash-2" color="error" variant="soft" size="sm" :loading="purging" @click="ask(keys)">
            {{ t("postfixPage.purgeSelection", { count: keys.length }) }}
          </UButton>
        </template>
        <template v-if="canPurge" #actions="{ row }">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :aria-label="t('postfixPage.purge')"
            :title="t('postfixPage.purge')"
            @click="ask([row.id])"
          />
        </template>
      </DataTable>
    </template>

    <ConfirmModal
      v-model:open="confirmOpen"
      type="danger"
      :title="confirmTitle"
      :description="confirmDescription"
      @confirm="confirmPurge"
    />
  </div>
</template>
