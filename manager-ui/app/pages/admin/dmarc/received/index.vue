<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "dmarc", action: "access" },
    { resource: "dmarc", action: "view-dmarc-reports" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.dmarc"), to: "/admin/dmarc" }, { label: t("dmarc.sections.received") }]);

const domain = ref(typeof route.query.domain === "string" ? route.query.domain : "");

const { items, total, loading, hasLoadedOnce, page, limit, search, searchBy, sortBy, sortDir } =
  usePaginatedList<DmarcIncomingReport>("dmarc-received", "/dmarc/incoming", "periodBegin", [domain], () => ({
    ...(domain.value ? { domain: domain.value } : {}),
  }));

const { hosted: domains } = useDmarcDomains();

watch(domain, () => {
  page.value = 1;
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <DmarcSections active="received" />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

    <DmarcReceivedTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:search-by="searchBy"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      v-model:domain="domain"
      :rows="items"
      :total="total"
      :loading="loading"
      :domains="domains"
    />
  </div>
</template>
