<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({ middleware: "auth" });

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

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const auth = useAuthStore();

const loading = ref(false);
const accounts = ref<ManagerAccount[]>([]);
const allDomains = ref<Domain[]>([]);

const inviteOpen = ref(false);
const inviteEmail = ref("");
const inviteSelectedDomains = ref<number[]>([]);
const inviteSending = ref(false);

const aclOpen = ref(false);
const aclAccount = ref<ManagerAccount | null>(null);
const aclSelected = ref<number[]>([]);
const aclSaving = ref(false);

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

async function sendInvite() {
  inviteSending.value = true;
  try {
    await call("/accounts/invite", {
      method: "POST",
      body: {
        email: inviteEmail.value,
        domainIds: inviteSelectedDomains.value.length ? inviteSelectedDomains.value : null,
      },
    });
    toast.add({ title: t("accounts.toast.invited"), color: "success" });
    inviteOpen.value = false;
    inviteEmail.value = "";
    inviteSelectedDomains.value = [];
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
  aclSelected.value = acc.domains.map((d) => d.id);
  aclOpen.value = true;
}

async function saveAcl() {
  if (!aclAccount.value) return;
  aclSaving.value = true;
  try {
    await call(`/accounts/${aclAccount.value.id}/acl`, {
      method: "PUT",
      body: { domainIds: aclSelected.value },
    });
    toast.add({ title: t("accounts.toast.aclSaved"), color: "success" });
    aclOpen.value = false;
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.aclFailed"), color: "error" });
  } finally {
    aclSaving.value = false;
  }
}

const domainOptions = computed(() => allDomains.value.map((d) => ({ label: d.domain, value: d.id })));

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
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
      </div>
      <UButton v-if="auth.session?.isRoot" icon="i-lucide-mail-plus" color="primary" @click="inviteOpen = true">
        {{ t("accounts.inviteButton") }}
      </UButton>
    </div>

    <UCard>
      <UTable
        :loading="loading"
        :rows="accounts"
        :columns="[
          { key: 'username', label: t('accounts.table.username') },
          { key: 'name', label: t('accounts.table.name') },
          { key: 'email', label: t('accounts.table.email') },
          { key: 'domains', label: t('accounts.table.domains') },
          { key: 'status', label: t('accounts.table.status') },
          { key: 'actions', label: '' },
        ]"
      >
        <template #username-data="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :alt="row.name ?? row.username" size="xs" />
            <span class="font-medium">{{ row.username }}</span>
            <UBadge v-if="row.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
          </div>
        </template>

        <template #name-data="{ row }">
          <span class="text-muted">{{ row.name ?? "-" }}</span>
        </template>

        <template #email-data="{ row }">
          <span class="text-muted text-sm">{{ row.email ?? "-" }}</span>
        </template>

        <template #domains-data="{ row }">
          <div v-if="row.isRoot" class="text-xs text-muted italic">{{ t("invite.allDomains") }}</div>
          <div v-else-if="row.domains.length === 0" class="text-xs text-dimmed">-</div>
          <div v-else class="flex flex-wrap gap-1">
            <UBadge v-for="d in row.domains.slice(0, 3)" :key="d.id" color="neutral" variant="subtle" size="xs">
              {{ d.domain }}
            </UBadge>
            <UBadge v-if="row.domains.length > 3" color="neutral" variant="subtle" size="xs">
              +{{ row.domains.length - 3 }}
            </UBadge>
          </div>
        </template>

        <template #status-data="{ row }">
          <UBadge :color="row.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
            {{ row.enabled ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </template>

        <template #actions-data="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <UButton
              v-if="!row.isRoot"
              icon="i-lucide-shield"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="t('accounts.acl.title')"
              @click="openAcl(row)"
            />
            <UButton
              v-if="!row.isRoot && row.enabled"
              icon="i-lucide-user-x"
              size="xs"
              color="error"
              variant="ghost"
              :title="t('common.revoke')"
              @click="revokeAccount(row)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal v-model:open="inviteOpen">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold">{{ t("accounts.invite.title") }}</h3>
          </template>

          <div class="space-y-4">
            <UFormField :label="t('accounts.invite.emailLabel')" required>
              <UInput v-model="inviteEmail" type="email" class="w-full" />
            </UFormField>

            <UFormField :label="t('accounts.invite.domainsLabel')" :hint="t('accounts.invite.domainsHint')">
              <div class="space-y-2 max-h-48 overflow-y-auto border border-default rounded-md p-2">
                <label v-for="opt in domainOptions" :key="opt.value" class="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    :value="opt.value"
                    :checked="inviteSelectedDomains.includes(opt.value)"
                    class="rounded"
                    @change="
                      (e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        inviteSelectedDomains = checked
                          ? [...inviteSelectedDomains, opt.value]
                          : inviteSelectedDomains.filter((id) => id !== opt.value);
                      }
                    "
                  />
                  <span class="text-sm">{{ opt.label }}</span>
                </label>
              </div>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="inviteOpen = false">
                {{ t("common.cancel") }}
              </UButton>
              <UButton color="primary" :loading="inviteSending" :disabled="!inviteEmail" @click="sendInvite">
                {{ t("accounts.invite.submit") }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="aclOpen">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold">{{ t("accounts.acl.title") }}</h3>
            <p v-if="aclAccount" class="text-sm text-muted">{{ aclAccount.username }}</p>
          </template>

          <p class="text-sm text-muted mb-3">{{ t("accounts.acl.hint") }}</p>
          <div class="space-y-2 max-h-56 overflow-y-auto border border-default rounded-md p-2">
            <label v-for="opt in domainOptions" :key="opt.value" class="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                :value="opt.value"
                :checked="aclSelected.includes(opt.value)"
                class="rounded"
                @change="
                  (e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    aclSelected = checked ? [...aclSelected, opt.value] : aclSelected.filter((id) => id !== opt.value);
                  }
                "
              />
              <span class="text-sm">{{ opt.label }}</span>
            </label>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="aclOpen = false">
                {{ t("common.cancel") }}
              </UButton>
              <UButton color="primary" :loading="aclSaving" @click="saveAcl">
                {{ t("accounts.acl.save") }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
