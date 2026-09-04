<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("activity.crumb") }]);

const action = ref("");

const { items, total, loading, hasLoadedOnce, page, limit, search, searchBy, sortBy, sortDir } = usePaginatedList<ActivityRow>(
  "my-activity",
  "/auth/jwt/me/activity",
  "createdAt",
  [action],
  () => ({ ...(action.value ? { action: action.value } : {}) })
);

const { data: actions } = useAsyncData("activity-actions", () => call<string[]>("/auth/jwt/me/activity/actions"), {
  server: false,
  default: () => [],
});

watch(action, () => {
  page.value = 1;
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-scroll-text"
      :title="t('activity.title')"
      :description="t('activity.subtitle')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

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
    />
  </div>
</template>
