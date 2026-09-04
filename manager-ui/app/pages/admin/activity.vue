<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "supervision", action: "access" },
    { resource: "supervision", action: "view-activity-log" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.activity") }]);

const action = ref("");
// A link from an account's page narrows the journal to that account.
const actorId = computed(() => (typeof route.query.actor === "string" ? route.query.actor : ""));

const { items, total, loading, hasLoadedOnce, page, limit, search, searchBy, sortBy, sortDir } = usePaginatedList<ActivityRow>(
  "all-activity",
  "/activity",
  "createdAt",
  [action, actorId],
  () => ({
    ...(action.value ? { action: action.value } : {}),
    ...(actorId.value ? { actorId: actorId.value } : {}),
  })
);

const { data: actions } = useAsyncData("activity-actions", () => call<string[]>("/auth/jwt/me/activity/actions"), {
  server: false,
  default: () => [],
});

watch([action, actorId], () => {
  page.value = 1;
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-scroll-text"
      :title="t('activity.server.title')"
      :description="t('activity.server.subtitle')"
    />

    <UAlert
      v-if="actorId"
      color="primary"
      variant="subtle"
      icon="i-lucide-user"
      :title="t('activity.server.oneAccount')"
      :actions="[{ label: t('activity.server.everyAccount'), to: '/admin/activity', color: 'neutral', variant: 'subtle' }]"
    />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

    <ActivityTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:search-by="searchBy"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      v-model:action="action"
      :rows="items"
      :total="total"
      :loading="loading"
      :actions="actions ?? []"
      with-account
    />
  </div>
</template>
