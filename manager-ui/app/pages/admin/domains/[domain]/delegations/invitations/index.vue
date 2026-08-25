<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
import type { DelegationPendingRow } from "~/composables/useDomainDelegations";

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
const { formatDateTime } = useDateTime();
const toast = useToast();
const { domainId, domainFqdn, rows, pending, loading, hasLoadedOnce, refresh } = useDomainDelegations();

const confirmRevoke = ref<DelegationPendingRow | null>(null);

const basePath = computed(() => `/admin/domains/${domainFqdn.value}/delegations`);
const columns = computed<DataTableColumn<DelegationPendingRow>[]>(() => [
  {
    key: "email",
    label: t("domains.delegations.email"),
    value: (row) => row.email ?? row.note ?? t("domains.delegations.tokenBadge"),
    primary: true,
  },
  { key: "mailboxes", label: t("domains.delegations.mailboxes"), value: (row) => row.maxRecipients ?? Number.POSITIVE_INFINITY },
  { key: "aliases", label: t("domains.delegations.aliases"), value: (row) => row.maxAliases ?? Number.POSITIVE_INFINITY },
  { key: "quota", label: t("domains.delegations.quotaMb"), value: (row) => row.quotaMb },
  {
    key: "expires",
    label: t("domains.delegations.expiresColumn"),
    value: (row) => (row.expiresAt === null ? null : new Date(row.expiresAt)),
  },
]);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value ?? "...", to: domainFqdn.value ? `/admin/domains/${domainFqdn.value}` : undefined },
    { label: t("domains.delegations.title"), to: basePath.value },
    { label: t("domains.delegations.pendingTitle") },
  ]);
});

function tokenLink(p: DelegationPendingRow) {
  return p.token ? `${window.location.origin}/invite/${p.token}` : null;
}

async function copyLink(link: string) {
  await navigator.clipboard.writeText(link);
  toast.add({ title: t("domains.delegations.copied"), icon: "i-lucide-copy", color: "success", duration: 1500 });
}

async function revoke() {
  const p = confirmRevoke.value;
  if (!p || !domainId.value) return;
  try {
    await call(`/domains/${domainId.value}/delegations/invitations/${p.id}`, { method: "DELETE" });
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
      icon="i-lucide-hourglass"
      :title="t('domains.delegations.pendingTitle')"
      :description="t('domains.delegations.pendingHint')"
    />

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <UButton icon="i-lucide-user-plus" color="info" variant="soft" :to="basePath">
        {{ t("domains.delegations.showDelegations") }}{{ hasLoadedOnce ? ` (${rows.length})` : "" }}
      </UButton>
      <div class="flex gap-2">
        <UButton icon="i-lucide-link" color="neutral" variant="soft" :to="`${basePath}/create?type=token`">
          {{ t("domains.delegations.createToken") }}
        </UButton>
        <UButton icon="i-lucide-plus" :to="`${basePath}/create`">{{ t("domains.delegations.invite") }}</UButton>
      </div>
    </div>

    <section class="space-y-4">
      <h2 class="font-semibold">{{ t("domains.delegations.pendingTitle") }}</h2>
      <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />
      <DataTable
        v-else
        :data="pending"
        :columns="columns"
        :loading="loading"
        :row-key="(row: DelegationPendingRow) => row.id"
        :empty-label="t('domains.delegations.pendingEmpty')"
      >
        <template #email="{ row }">
          <template v-if="row.email">
            <FullTooltip :text="row.email">
              <span class="font-medium">{{ truncateChars(row.email, 40) }}</span>
            </FullTooltip>
          </template>
          <UBadge v-else color="warning" variant="subtle">{{ row.note ?? t("domains.delegations.tokenBadge") }}</UBadge>
        </template>
        <template #mailboxes="{ row }">{{ row.maxRecipients ?? t("domains.delegations.unlimited") }}</template>
        <template #aliases="{ row }">{{ row.maxAliases ?? t("domains.delegations.unlimited") }}</template>
        <template #quota="{ row }">{{ row.quotaMb }} MB</template>
        <template #expires="{ row }">
          {{ row.expiresAt === null ? t("domains.delegations.noExpiryShort") : formatDateTime(row.expiresAt) }}
        </template>
        <template #actions="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              v-if="tokenLink(row)"
              icon="i-lucide-copy"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('domains.delegations.copyLink')"
              @click="() => copyLink(tokenLink(row) as string)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('domains.delegations.editInviteTitle')"
              :to="`${basePath}/invitations/edit/${row.id}`"
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
      :description="t('domains.delegations.revokeInviteConfirm')"
      @update:open="
        (v: boolean) => {
          if (!v) confirmRevoke = null;
        }
      "
      @confirm="revoke"
    />
  </div>
</template>
