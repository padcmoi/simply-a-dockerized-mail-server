<script setup lang="ts">
// One card per figure rather than four columns inside one: they are four
// different measurements, they are read one at a time, and a card each is what
// lets them wrap on a narrow screen instead of being squeezed into a strip.
//
// One feed for the four cards, and one window for the four curves: four charts
// covering four different periods cannot be read against each other, which is
// most of what a row of them is for. The figures on the header lines are always
// live, whatever window the curves below are set to.
import type { MetricRange } from "~/composables/useMetricWindow";

const { t } = useI18n();
const { snapshot, history, status } = useSystemMetrics();

const range = ref<MetricRange>("minute");
const { points, at, notice } = useMetricWindow(range, () => history.value);
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <h3 class="flex items-center gap-2 text-sm font-medium">
        <UIcon name="i-lucide-activity" class="size-4 text-primary" />
        {{ t("supervision.machine") }}
      </h3>

      <UBadge v-if="status === 'live'" color="success" variant="subtle" size="sm">
        <span class="relative mr-1 flex size-1.5">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
          <span class="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
        {{ t("supervision.live") }}
      </UBadge>
      <UBadge v-else-if="status === 'connecting'" color="neutral" variant="subtle" size="sm">
        <UIcon name="i-lucide-loader-circle" class="mr-1 size-3 animate-spin" />
        {{ t("supervision.connecting") }}
      </UBadge>
      <UBadge v-else color="warning" variant="subtle" size="sm" icon="i-lucide-unplug">
        {{ t("supervision.offline") }}
      </UBadge>
    </div>

    <!-- Nothing has arrived yet and no card can say anything: what is shown is
         the shape of what is coming, not a row of dashes. A dash cannot be told
         apart from a zero, from a broken feed, or from a figure this host does
         not have, four different things a reader would react to differently. -->
    <div v-if="!snapshot && status === 'connecting'" class="grid items-stretch gap-4 lg:grid-cols-2">
      <UCard v-for="card in 4" :key="card" class="h-full">
        <div class="space-y-4">
          <USkeleton class="h-44 w-full" />
          <USkeleton class="h-3 w-40" />
        </div>
      </UCard>
    </div>

    <!-- And when it is not coming: say so, say why, and say that it comes back
         on its own. -->
    <UCard v-else-if="!snapshot">
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-unplug" class="mt-0.5 size-5 shrink-0 text-warning" />
        <div class="space-y-1">
          <p class="font-medium">{{ t("supervision.unavailableTitle") }}</p>
          <p class="text-sm text-muted">{{ t("supervision.unavailableHint") }}</p>
        </div>
      </div>
    </UCard>

    <!-- Held at reduced opacity while the feed is away rather than replaced by a
         skeleton: the last figures are still the truth of a moment ago, and a
         card that empties on every reconnect is a card that flashes. -->
    <div v-else class="grid items-stretch gap-4 transition-opacity lg:grid-cols-2" :class="status !== 'live' && 'opacity-60'">
      <SystemCpuCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
      <SystemLoadCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
      <SystemMemoryCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
      <SystemNetworkCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
    </div>
  </section>
</template>
