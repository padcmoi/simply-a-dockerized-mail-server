<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "dmarc", action: "access" },
    { resource: "dmarc", action: "view-dmarc-reports" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.dmarc"), to: "/admin/dmarc" }, { label: t("dmarc.sections.sent") }]);

const status = ref("");
const domain = ref("");
const { hosted: domains } = useDmarcDomains();

const { items, total, loading, hasLoadedOnce, page, limit, search, searchBy, sortBy, sortDir, load } =
  usePaginatedList<DmarcOutgoingReport>("dmarc-sent", "/dmarc/outgoing", "createdAt", [status], () => ({
    ...(status.value ? { status: status.value } : {}),
  }));

watch([status, domain], () => {
  page.value = 1;
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <DmarcSections active="sent" />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="7" />

    <DmarcSentTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:search-by="searchBy"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      v-model:status="status"
      v-model:domain="domain"
      :domains="domains"
      :rows="items"
      :total="total"
      :loading="loading"
      @changed="load"
    />
  </div>
</template>
