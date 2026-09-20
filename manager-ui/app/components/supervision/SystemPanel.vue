<script setup lang="ts">
// One card per figure rather than four columns inside one: they are four
// different measurements, they are read one at a time, and a card each is what
// lets them wrap on a narrow screen instead of being squeezed into a strip.
//
// One feed for the four cards, and one window for the four curves: four charts
// covering four different periods cannot be read against each other, which is
// most of what a row of them is for. The figures on the header lines are always
// live, whatever window the curves below are set to.

const { t } = useI18n();
const { snapshot, history, status, thresholds } = useSystemMetrics();

// Where the top bar is: the panel's own header line sits under it and takes the
// top of the window when it slides away.
const headroom = useHeadroom();

const { y } = useWindowScroll();

const panel = useTemplateRef<HTMLElement>("panel");
const line = useTemplateRef<HTMLElement>("line");

const RANGE_STORAGE_KEY = "manager-supervision-range";

// The window is the panel's, and this browser keeps it: a reader who watches
// the day is shown the day again on the next visit rather than the minute and a
// tag to click. Read on mount, so the server never renders one window and the
// page hydrates on another, and anything that is not one of the four tags falls
// back to the live minute.
const stored = useLocalStorage<MetricRange>(RANGE_STORAGE_KEY, "minute", { initOnMounted: true });

// One pause for the four curves, for the same reason there is one window: they
// are read against each other, and holding one of them alone would put four
// different moments side by side. It holds the drawing, not the feed, so the
// header figures stay live and nothing is missing when it is lifted.
const paused = ref(false);

// Whether the header line has left its place and is riding the top of the
// window, which is when it needs a ground of its own: over a chart, a line
// wearing the page's own background is a line standing on nothing. Read from
// the line against the panel it opens, so the offset it is pinned at, which
// moves with the top bar, is never a number written here.
const stuck = shallowRef(false);

const range = computed<MetricRange>({
  get: () => (SUPERVISION_WINDOWS.includes(stored.value) ? stored.value : "minute"),
  set: (window) => (stored.value = window),
});

const { points, at, notice, nextRefresh } = useMetricWindow(range, () => history.value, paused);

// One window feeds the eight cards, so the wait is the same in all of them and
// it is written once, beside the state of the feed rather than in every header.
const countdown = computed(() => {
  const left = nextRefresh.value;
  if (left === null) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
});

watch(y, measure);

function measure() {
  const opening = panel.value?.getBoundingClientRect().top;
  const here = line.value?.getBoundingClientRect().top;
  stuck.value = opening !== undefined && here !== undefined && here - opening > 2;
}

function togglePause() {
  paused.value = !paused.value;
}

onMounted(measure);
</script>

<template>
  <section ref="panel" class="space-y-3">
    <!-- Pinned: the state of the feed, the alerts, the pause and the wait
         before the next window are read against a card that is being scrolled,
         and a row that has left the window is a row that has to be scrolled
         back to. It rides under the top bar and takes its place the moment the
         bar slides away, rather than the two of them sharing a strip. -->
    <div
      ref="line"
      class="sticky z-30 -mx-4 flex items-center justify-between gap-3 px-4 py-2 transition-colors sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8"
      :class="[headroom ? 'top-0' : 'top-(--ui-header-height)', stuck && 'border-b border-default bg-elevated shadow-sm']"
    >
      <h3 class="flex items-center gap-2 text-sm font-medium">
        <UIcon name="i-lucide-activity" class="size-4 text-primary" />
        {{ t("supervision.machine") }}
      </h3>

      <div class="flex items-center gap-2">
        <UTooltip v-if="countdown" :text="t('supervision.nextRefresh')">
          <UBadge color="info" variant="subtle" icon="i-lucide-refresh-cw" class="tabular-nums">
            {{ countdown }}
          </UBadge>
        </UTooltip>

        <MachineAlertsToggle />

        <UTooltip v-if="snapshot" :text="t(paused ? 'supervision.resume' : 'supervision.pause')">
          <UButton
            :icon="paused ? 'i-lucide-play' : 'i-lucide-pause'"
            :color="paused ? 'warning' : 'neutral'"
            :aria-label="t(paused ? 'supervision.resume' : 'supervision.pause')"
            variant="subtle"
            size="sm"
            @click="togglePause"
          />
        </UTooltip>

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
    <template v-else>
      <div class="grid items-stretch gap-4 transition-opacity lg:grid-cols-2" :class="status !== 'live' && 'opacity-60'">
        <SystemCpuCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
        <SystemLoadCard v-bind="{ snapshot, points, at, notice, thresholds }" v-model:range="range" />
        <SystemMemoryCard v-bind="{ snapshot, points, at, notice, thresholds }" v-model:range="range" />
        <SystemNetworkCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
        <SystemDiskCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
        <RspamdActivityCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
        <PostfixQueueCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
        <Fail2banBansCard v-bind="{ snapshot, points, at, notice }" v-model:range="range" />
      </div>
    </template>
  </section>
</template>
