<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "view-account-sessions" },
  ],
});

interface Session {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  online: boolean;
}

interface AccountSummary {
  accountId: string;
  email: string | null;
  displayName: string | null;
  activeCount: number;
  expiredCount: number;
  online: boolean;
}

const route = useRoute();
const { t, locale } = useI18n();
const { call } = useApi();
const toast = useToast();
const { bump } = useDataRefresh();
const { set: setBreadcrumb } = useBreadcrumb();
const { isRoot, hasGlobal } = usePermissions();

const account = ref<AccountSummary | null>(null);
const sessions = ref<Session[]>([]);
const loading = ref(false);
const loaded = ref(false);
const revokingId = ref<number | null>(null);
const revokingAll = ref(false);

const userId = computed(() => route.params.userId as string);
const canRevoke = computed(() => isRoot.value || hasGlobal("accounts", "revoke-account-sessions"));
const accountLabel = computed(() =>
  account.value ? account.value.displayName || account.value.email || userId.value : userId.value
);

watch(
  accountLabel,
  (label) => {
    setBreadcrumb([
      { label: t("nav.accounts"), to: "/admin/accounts" },
      { label: t("accounts.allSessions.label"), to: "/admin/accounts/sessions" },
      { label },
      { label: t("accounts.allSessions.detail.activeCrumb") },
    ]);
  },
  { immediate: true }
);

// Reload on the shared refresh tick (header button, focus, heartbeat) so the
// online badges stay live.
watch(useDataRefresh().tick, () => load());

async function load() {
  loading.value = true;
  try {
    const [overview, list] = await Promise.all([
      call<AccountSummary[]>("/accounts/sessions/overview"),
      call<Session[]>(`/accounts/${userId.value}/sessions/active`),
    ]);
    account.value = overview.find((a) => a.accountId === userId.value) ?? null;
    sessions.value = list;
  } catch (e) {
    toast.add({ title: t("accounts.allSessions.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(locale.value.replace(/_/g, "-"));
}

function deviceLabel(ua: string | null) {
  const parsed = parseUserAgent(ua);
  if (parsed.browser && parsed.os) {
    return t("profile.sessionsPage.deviceOn", { browser: parsed.browser, os: parsed.os });
  }
  return parsed.browser ?? parsed.os ?? t("profile.sessionsPage.unknownDevice");
}

function deviceIcon(ua: string | null) {
  return parseUserAgent(ua).icon;
}

async function revoke(id: number) {
  revokingId.value = id;
  try {
    await call(`/accounts/${userId.value}/sessions/${id}`, { method: "DELETE" });
    toast.add({ title: t("accounts.allSessions.toast.revoked"), color: "success" });
    await load();
    bump();
  } catch (e) {
    toast.add({ title: t("accounts.allSessions.toast.revokeFailed"), description: (e as Error).message, color: "error" });
  } finally {
    revokingId.value = null;
  }
}

async function revokeAll() {
  revokingAll.value = true;
  try {
    await call(`/accounts/${userId.value}/sessions`, { method: "DELETE" });
    toast.add({ title: t("accounts.allSessions.toast.revokedAll"), color: "success" });
    await load();
    bump();
  } catch (e) {
    toast.add({ title: t("accounts.allSessions.toast.revokeFailed"), description: (e as Error).message, color: "error" });
  } finally {
    revokingAll.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts/sessions" size="sm">
      {{ t("accounts.allSessions.label") }}
    </UButton>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold truncate">
            {{ t("accounts.allSessions.detail.activeTitle", { account: accountLabel }) }}
          </h2>
          <UButton
            v-if="canRevoke && sessions.length > 0"
            icon="i-lucide-log-out"
            color="error"
            variant="soft"
            size="xs"
            :loading="revokingAll"
            class="shrink-0"
            @click="revokeAll"
          >
            {{ t("accounts.allSessions.detail.revokeAll") }}
          </UButton>
        </div>
      </template>

      <div v-if="loading && !loaded" class="space-y-3 py-1">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <UEmptyState v-else-if="sessions.length === 0" icon="i-lucide-monitor" :title="t('accounts.allSessions.activeEmpty')" />

      <ul v-else class="divide-y divide-default">
        <li v-for="s in sessions" :key="s.id" class="py-3 flex items-center gap-3">
          <div class="rounded-md p-2 bg-elevated shrink-0">
            <UIcon :name="deviceIcon(s.userAgent)" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate" :title="s.userAgent ?? undefined">{{ deviceLabel(s.userAgent) }}</p>
            <p class="text-xs text-muted truncate">
              {{ s.ip || t("profile.sessionsPage.unknownIp") }} · {{ t("profile.sessionsPage.signedIn") }}
              {{ fmt(s.createdAt) }}
            </p>
          </div>
          <SessionPresence :online="s.online" :last-seen-at="s.lastSeenAt" />
          <UBadge color="success" variant="subtle" class="shrink-0">{{ t("profile.sessionsPage.active") }}</UBadge>
          <UButton
            v-if="canRevoke"
            icon="i-lucide-log-out"
            color="error"
            variant="ghost"
            size="sm"
            :loading="revokingId === s.id"
            :title="t('profile.sessionsPage.revoke')"
            @click="revoke(s.id)"
          />
        </li>
      </ul>
    </UCard>
  </div>
</template>
