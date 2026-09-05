<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "create-recipient" },
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "create-alias" },
  ],
});

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { set: setBreadcrumb } = useBreadcrumb();
const toast = useToast();
const { domainId, domainFqdn, rows, pending, loading, hasLoadedOnce, refresh } = useDomainDelegations();

const confirmRevoke = ref<DelegationRow | null>(null);

const basePath = computed(() => `/admin/domains/${domainFqdn.value}/delegations`);
const columns = computed<DataTableColumn<DelegationRow>[]>(() => [
  { key: "email", label: t("domains.delegations.email"), value: (row) => row.accountEmail ?? row.accountId, primary: true },
  { key: "mailboxes", label: t("domains.delegations.mailboxes"), value: (row) => row.usedRecipients },
  { key: "aliases", label: t("domains.delegations.aliases"), value: (row) => row.usedAliases },
  { key: "quota", label: t("domains.delegations.quotaMb"), value: (row) => Number(row.usedBytes) },
]);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value ?? "...", to: domainFqdn.value ? `/admin/domains/${domainFqdn.value}` : undefined },
    { label: t("domains.delegations.title") },
  ]);
});

function capLabel(used: number, max: number | null) {
  return max === null ? t("domains.delegations.usedUnlimited", { used }) : t("domains.delegations.used", { used, max });
}

async function revoke() {
  const d = confirmRevoke.value;
  if (!d || !domainId.value) return;
  try {
    await call(`/domains/${domainId.value}/delegations/${d.accountId}`, { method: "DELETE" });
    toast.add({ title: t("domains.delegations.revoked"), color: "success" });
    await refresh();
  } catch (e) {
    toast.add({ title: t("domains.delegations.revokeFailed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    confirmRevoke.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-user-plus"
      :title="t('domains.delegations.title')"
      :description="t('domains.delegations.subtitle')"
    />

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <UButton icon="i-lucide-hourglass" color="info" variant="soft" :to="`${basePath}/invitations`">
        {{ t("domains.delegations.showInvitations") }}{{ hasLoadedOnce ? ` (${pending.length})` : "" }}
      </UButton>
      <div class="flex gap-2">
        <UButton icon="i-lucide-link" color="neutral" variant="soft" :to="`${basePath}/create?type=token`">
          {{ t("domains.delegations.createToken") }}
        </UButton>
        <UButton icon="i-lucide-plus" :to="`${basePath}/create`">{{ t("domains.delegations.invite") }}</UButton>
      </div>
    </div>

    <section class="space-y-4">
      <h2 class="font-semibold">{{ t("domains.delegations.title") }}</h2>
      <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />
      <DataTable
        v-else
        :data="rows"
        :columns="columns"
        :loading="loading"
        :row-key="(row: DelegationRow) => row.accountId"
        :empty-label="t('domains.delegations.empty')"
      >
        <template #email="{ row }">
          <FullTooltip :text="row.accountEmail ?? row.accountId">
            <span class="font-medium">{{ truncateChars(row.accountEmail ?? row.accountId, 40) }}</span>
          </FullTooltip>
        </template>
        <template #mailboxes="{ row }">{{ capLabel(row.usedRecipients, row.maxRecipients) }}</template>
        <template #aliases="{ row }">{{ capLabel(row.usedAliases, row.maxAliases) }}</template>
        <template #quota="{ row }">
          {{
            t("domains.delegations.usedQuota", { used: formatBytes(Number(row.usedBytes)), total: formatBytes(row.quotaMb * MB) })
          }}
        </template>
        <template #actions="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('domains.delegations.edit')"
              :to="`${basePath}/edit/${row.accountId}`"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('domains.delegations.revoke')"
              @click="
                () => {
                  confirmRevoke = row;
                }
              "
            />
          </div>
        </template>
      </DataTable>
    </section>

    <ConfirmModal
      :open="!!confirmRevoke"
      :title="t('domains.delegations.revoke')"
      :description="t('domains.delegations.revokeConfirm')"
      @update:open="
        (v: boolean) => {
          if (!v) confirmRevoke = null;
        }
      "
      @confirm="revoke"
    />
  </div>
</template>
