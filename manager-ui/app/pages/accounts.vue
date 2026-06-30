<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({});

interface AccountDomain {
  id: number;
  domain: string;
}
interface ManagerAccount {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  isRoot: boolean;
  enabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  domains: AccountDomain[];
}
interface Domain {
  id: number;
  domain: string;
}

const loading = ref(false);
const accounts = ref<ManagerAccount[]>([]);
const allDomains = ref<Domain[]>([]);

const inviteOpen = ref(false);
const inviteSending = ref(false);

const aclOpen = ref(false);
const aclAccount = ref<ManagerAccount | null>(null);
const aclSaving = ref(false);

const domainOptions = computed(() => allDomains.value.map((d) => ({ label: d.domain, value: d.id })));

const columns = computed(() => [
  { accessorKey: "username", header: t("accounts.table.username") },
  { accessorKey: "name", header: t("accounts.table.name") },
  { accessorKey: "email", header: t("accounts.table.email") },
  { id: "domains", header: t("accounts.table.domains") },
  { id: "status", header: t("accounts.table.status") },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const auth = useAuthStore();

async function load() {
  loading.value = true;
  try {
    [accounts.value, allDomains.value] = await Promise.all([call<ManagerAccount[]>("/accounts"), call<Domain[]>("/domains")]);
  } catch {
    toast.add({ title: t("accounts.toast.loadFailed"), color: "error" });
  } finally {
    loading.value = false;
  }
}

async function sendInvite(data: { email: string; domainIds: number[] | null }) {
  inviteSending.value = true;
  try {
    await call("/accounts/invite", { method: "POST", body: data });
    toast.add({ title: t("accounts.toast.invited"), color: "success" });
    inviteOpen.value = false;
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.inviteFailed"), color: "error" });
  } finally {
    inviteSending.value = false;
  }
}

async function revokeAccount(acc: ManagerAccount) {
  if (!confirm(t("accounts.confirmRevoke"))) return;
  try {
    await call(`/accounts/${acc.id}`, { method: "DELETE" });
    toast.add({ title: t("accounts.toast.revoked"), color: "success" });
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.revokeFailed"), color: "error" });
  }
}

function openAcl(acc: ManagerAccount) {
  aclAccount.value = acc;
  aclOpen.value = true;
}

async function saveAcl(domainIds: number[]) {
  if (!aclAccount.value) return;
  aclSaving.value = true;
  try {
    await call(`/accounts/${aclAccount.value.id}/acl`, { method: "PUT", body: { domainIds } });
    toast.add({ title: t("accounts.toast.aclSaved"), color: "success" });
    aclOpen.value = false;
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.aclFailed"), color: "error" });
  } finally {
    aclSaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users"
      :title="t('accounts.alertTitle')"
      :description="t('accounts.alertDescription')"
      color="info"
      variant="subtle"
    />

    <div class="flex items-center justify-between gap-2">
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
      <UButton v-if="auth.session?.isRoot" icon="i-lucide-mail-plus" color="primary" @click="inviteOpen = true">
        {{ t("accounts.inviteButton") }}
      </UButton>
    </div>

    <UCard class="hidden lg:block">
      <UTable :loading="loading" :data="accounts" :columns="columns" sticky>
        <template #username-cell="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :alt="row.original.name ?? row.original.username" size="xs" />
            <span class="font-medium">{{ row.original.username }}</span>
            <UBadge v-if="row.original.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
          </div>
        </template>
        <template #name-cell="{ row }">
          <span class="text-muted">{{ row.original.name ?? "-" }}</span>
        </template>
        <template #email-cell="{ row }">
          <span class="text-muted text-sm">{{ row.original.email ?? "-" }}</span>
        </template>
        <template #domains-cell="{ row }">
          <div v-if="row.original.isRoot" class="text-xs text-muted italic">{{ t("invite.allDomains") }}</div>
          <div v-else-if="row.original.domains.length === 0" class="text-xs text-dimmed">-</div>
          <div v-else class="flex flex-wrap gap-1">
            <UBadge v-for="d in row.original.domains.slice(0, 3)" :key="d.id" color="neutral" variant="subtle" size="xs">{{
              d.domain
            }}</UBadge>
            <UBadge v-if="row.original.domains.length > 3" color="neutral" variant="subtle" size="xs"
              >+{{ row.original.domains.length - 3 }}</UBadge
            >
          </div>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
            {{ row.original.enabled ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <UButton
              v-if="!row.original.isRoot"
              icon="i-lucide-shield"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="t('accounts.acl.title')"
              @click="openAcl(row.original)"
            />
            <UButton
              v-if="!row.original.isRoot && row.original.enabled"
              icon="i-lucide-user-x"
              size="xs"
              color="error"
              variant="ghost"
              :title="t('common.revoke')"
              @click="revokeAccount(row.original)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <div class="lg:hidden space-y-3">
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="accounts.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <AccountCard
        v-for="acc in accounts"
        v-else
        :key="acc.id"
        :account="acc"
        @open-acl="openAcl(acc)"
        @revoke="revokeAccount(acc)"
      />
    </div>

    <AccountInviteModal v-model:open="inviteOpen" :domain-options="domainOptions" :sending="inviteSending" @submit="sendInvite" />

    <AccountAclModal
      v-model:open="aclOpen"
      :username="aclAccount?.username ?? ''"
      :domain-options="domainOptions"
      :initial-selected="aclAccount?.domains.map((d) => d.id) ?? []"
      :saving="aclSaving"
      @save="saveAcl"
    />
  </div>
</template>
