<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "view-account" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { isRoot, hasGlobal } = usePermissions();

const overview = ref<AccountOverview | null>(null);
const loading = ref(false);

const accountId = computed(() => String(route.params.id));
const account = computed(() => overview.value?.account ?? null);
const domains = computed(() => overview.value?.domains ?? []);
const recipients = computed(() => overview.value?.recipients ?? []);
const aliases = computed(() => overview.value?.aliases ?? []);
const activeDomains = computed(() => domains.value.filter((d) => d.active).length);
const activeRecipients = computed(() => recipients.value.filter((r) => r.active).length);
const avatarAlt = computed(() => account.value?.displayName || account.value?.email || "?");

const canEdit = computed(() => isRoot.value || hasGlobal("accounts", "edit-account"));
const canManageGroups = computed(() => isRoot.value || hasGlobal("accounts", "view-account"));
const canManageRecipients = computed(() => isRoot.value || hasGlobal("accounts", "assign-recipient-owner"));
const canManageAliases = computed(() => isRoot.value || hasGlobal("accounts", "assign-alias-owner"));

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.accounts"), to: "/admin/accounts" }, { label: account.value?.email ?? "..." }]);
});

async function load() {
  loading.value = true;
  try {
    overview.value = await call<AccountOverview>(`/accounts/${accountId.value}/overview`);
  } catch (e) {
    toast.add({ title: t("accounts.overviewPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-layout-dashboard"
      :title="t('accounts.overviewPage.alertTitle')"
      :description="t('accounts.overviewPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <div v-if="loading && !overview" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <template v-else-if="account">
      <UCard>
        <div class="flex items-center gap-4 flex-wrap">
          <UAvatar :src="account.avatarUrl ?? undefined" :alt="avatarAlt" size="3xl" class="shrink-0" />
          <div class="min-w-0">
            <p class="text-lg font-semibold truncate">{{ account.email }}</p>
            <p class="text-sm text-muted truncate">{{ account.displayName || "-" }}</p>
          </div>
          <div class="flex flex-wrap gap-1 ml-auto">
            <UBadge v-if="account.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
              {{ t("layout.rootBadge") }}
            </UBadge>
            <UBadge :color="account.enabled ? 'success' : 'neutral'" variant="subtle">
              {{ account.enabled ? t("common.active") : t("common.inactive") }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <DomainStatCard
          :label="t('nav.domains')"
          :value="domains.length"
          :sub="t('accounts.overviewPage.activeCount', { count: activeDomains })"
          icon="i-lucide-globe"
          icon-color="text-primary"
        />
        <DomainStatCard
          :label="t('nav.recipients')"
          :value="recipients.length"
          :sub="t('accounts.overviewPage.activeCount', { count: activeRecipients })"
          icon="i-lucide-users"
          icon-color="text-info"
        />
        <DomainStatCard
          :label="t('nav.aliases')"
          :value="aliases.length"
          :sub="t('accounts.overviewPage.stats.aliasesSub')"
          icon="i-lucide-share-2"
          icon-color="text-warning"
        />
        <DomainStatCard
          :label="t('nav.groups')"
          :value="account.groups.length"
          :sub="t('accounts.overviewPage.stats.groupsSub')"
          icon="i-lucide-users-round"
          icon-color="text-success"
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UCard
          v-if="canEdit"
          :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
          @click="navigateTo(`/admin/accounts/${accountId}/edit`)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-user-cog" class="text-primary text-xl" />
            <span class="font-medium">{{ t("accounts.overviewPage.actions.edit") }}</span>
            <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
          </div>
        </UCard>
        <UCard
          v-if="canManageGroups && !account.isRoot"
          :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
          @click="navigateTo(`/admin/accounts/${accountId}/groups`)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-users-round" class="text-success text-xl" />
            <span class="font-medium">{{ t("accounts.overviewPage.actions.groups") }}</span>
            <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
          </div>
        </UCard>
        <UCard
          v-if="canManageRecipients"
          :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
          @click="navigateTo(`/admin/accounts/${accountId}/recipients`)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-mailbox" class="text-info text-xl" />
            <span class="font-medium">{{ t("accounts.overviewPage.actions.recipients") }}</span>
            <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
          </div>
        </UCard>
        <UCard
          v-if="canManageAliases"
          :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
          @click="navigateTo(`/admin/accounts/${accountId}/aliases`)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-share-2" class="text-warning text-xl" />
            <span class="font-medium">{{ t("accounts.overviewPage.actions.aliases") }}</span>
            <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
          </div>
        </UCard>
      </div>

      <OwnedResourcesCards :domains="domains" :recipients="recipients" />
    </template>
  </div>
</template>
