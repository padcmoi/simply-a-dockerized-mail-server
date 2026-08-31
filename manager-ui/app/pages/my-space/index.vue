<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();
const { tick } = useDataRefresh();
const route = useRoute();

setBreadcrumb([{ label: t("nav.myspace") }]);

const { data, status } = useAsyncData<MySpaceOverview>("myspace-overview", () => call<MySpaceOverview>("/auth/jwt/me/overview"), {
  server: false,
  watch: [tick],
  default: () => ({ domains: [], recipients: [], aliases: [] }),
});

const TABS = ["domains", "delegations", "recipients", "aliases"] as const;

// The active tab is remembered app-wide: coming back to /my-space without a
// ?tab query (breadcrumb, sidebar, Back buttons) reopens the last tab instead
// of the "recipients" default. An explicit ?tab in the URL still wins.
const storedTab = useState<string>("myspace-active-tab", () => "recipients");

const hasLoadedOnce = ref(false);
const tab = ref<string>(TABS.includes(route.query.tab as (typeof TABS)[number]) ? String(route.query.tab) : storedTab.value);

const failed = computed(() => status.value === "error");
const loading = computed(() => status.value === "pending");
const domains = computed(() => data.value?.domains ?? []);
const recipients = computed(() => data.value?.recipients ?? []);
const aliases = computed(() => data.value?.aliases ?? []);
const domainColumns = computed<DataTableColumn<OwnedDomain>[]>(() => [
  { key: "domain", label: t("myspace.table.domain"), value: (row) => row.domain, primary: true },
  { key: "quota", label: t("myspace.table.quota"), value: (row) => row.quota },
  { key: "active", label: t("myspace.table.status"), value: (row) => row.active },
]);

// Icon-only triggers: each section already carries its own title in the page.
const tabs = computed(() => [
  { value: "recipients", icon: "i-lucide-mail", ariaLabel: t("myspace.ownedRecipients") },
  { value: "aliases", icon: "i-lucide-at-sign", ariaLabel: t("myspace.ownedAliases") },
  { value: "domains", icon: "i-lucide-globe", ariaLabel: t("myspace.ownedDomains") },
  { value: "delegations", icon: "i-lucide-user-plus", ariaLabel: t("myspace.delegations.title") },
]);

watch(
  status,
  (s) => {
    if (s === "success" || s === "error") hasLoadedOnce.value = true;
  },
  { immediate: true }
);

// The active tab survives a refresh and a round-trip to the creation pages.
watch(
  tab,
  (v) => {
    storedTab.value = v;
    if (v !== (route.query.tab ?? "recipients")) {
      navigateTo({ query: v === "recipients" ? {} : { tab: v } }, { replace: true });
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-house"
      :title="t('myspace.alertTitle')"
      :description="t('myspace.alertDescription')"
    />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('myspace.loadFailed')" />

    <UTabs
      v-model="tab"
      :items="tabs"
      :content="false"
      :ui="{
        list: 'justify-around w-full',
        trigger: 'grow flex-col gap-1 py-2',
        leadingIcon: 'size-7',
      }"
      class="w-full"
    />

    <section v-if="tab === 'domains'" class="space-y-4">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold">{{ t("myspace.ownedDomains") }}</h2>
        <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ domains.length }}</UBadge>
      </div>

      <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />

      <DataTable
        v-else
        :data="domains"
        :columns="domainColumns"
        :loading="loading"
        :row-key="(row: OwnedDomain) => row.id"
        sort-key="domain"
        :empty-label="t('myspace.noDomains')"
      >
        <template #domain="{ row }">
          <FullTooltip :text="row.domain">
            <span class="font-medium">{{ truncateChars(row.domain, 40) }}</span>
          </FullTooltip>
        </template>

        <template #quota="{ row }">
          <span class="text-muted">{{ row.quota }}</span>
        </template>

        <template #active="{ row }">
          <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.active ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </template>
      </DataTable>
    </section>

    <MyDelegationsSection v-else-if="tab === 'delegations'" />

    <OwnedRecipientsTable
      v-else-if="tab === 'recipients'"
      :recipients="recipients"
      :loading="loading"
      :has-loaded-once="hasLoadedOnce"
    />
    <OwnedAliasesTable v-else :aliases="aliases" :loading="loading" :has-loaded-once="hasLoadedOnce" />
  </div>
</template>
