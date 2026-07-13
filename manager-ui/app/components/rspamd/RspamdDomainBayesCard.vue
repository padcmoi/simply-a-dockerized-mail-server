<script setup lang="ts">
import type { RspamdDomainBayes } from "~/composables/useRspamdPage";

const props = defineProps<{
  bayes: RspamdDomainBayes | null | undefined;
  loading: boolean;
}>();

const { t } = useI18n();
const PAGE_SIZE = 4;

const page = ref(1);

// The server already returns recipients sorted by total learns descending; we
// re-sort here so the card is correct on its own regardless of upstream order,
// then page 5 at a time client-side (the whole list is already in the stats
// payload, there's nothing extra to fetch).
const sorted = computed(() =>
  [...(props.bayes?.recipients ?? [])].sort((a, b) => b.learnsHam + b.learnsSpam - (a.learnsHam + a.learnsSpam))
);
const pageItems = computed(() => sorted.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

// Clamp back into range when the list shrinks (e.g. switching domains) so we
// never strand on an empty page past the end.
watch(sorted, () => {
  const lastPage = Math.max(1, Math.ceil(sorted.value.length / PAGE_SIZE));
  if (page.value > lastPage) page.value = lastPage;
});
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-brain" class="text-primary shrink-0" />
          {{ t("domainDashboard.rspamd.bayes.title") }}
        </h2>
        <div v-if="bayes" class="flex items-center gap-1.5 shrink-0">
          <UBadge color="success" variant="subtle" icon="i-lucide-thumbs-up" size="sm">
            {{ bayes.totalHam.toLocaleString() }}
          </UBadge>
          <UBadge color="error" variant="subtle" icon="i-lucide-thumbs-down" size="sm">
            {{ bayes.totalSpam.toLocaleString() }}
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="loading && !bayes" class="space-y-2">
      <USkeleton v-for="i in PAGE_SIZE" :key="i" class="h-9 w-full" />
    </div>

    <template v-else-if="sorted.length">
      <div class="space-y-1">
        <div
          v-for="r in pageItems"
          :key="r.recipient"
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-elevated/50"
        >
          <span class="truncate min-w-0" :title="r.recipient">{{ r.recipient }}</span>
          <div class="flex items-center gap-3 shrink-0 tabular-nums">
            <span class="flex items-center gap-1 text-success">
              <UIcon name="i-lucide-thumbs-up" class="size-3.5" />{{ r.learnsHam.toLocaleString() }}
            </span>
            <span class="flex items-center gap-1 text-error">
              <UIcon name="i-lucide-thumbs-down" class="size-3.5" />{{ r.learnsSpam.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="sorted.length > PAGE_SIZE" class="mt-4">
        <ListPagination v-model:page="page" :total="sorted.length" :limit="PAGE_SIZE" />
      </div>
    </template>

    <div v-else class="flex flex-col items-center justify-center text-center gap-2 py-10 text-muted">
      <UIcon name="i-lucide-brain-circuit" class="size-8 text-dimmed" />
      <p class="text-sm">{{ t("domainDashboard.rspamd.bayes.noData") }}</p>
      <p class="text-xs text-dimmed max-w-xs">{{ t("domainDashboard.rspamd.bayes.hint") }}</p>
    </div>
  </UCard>
</template>
