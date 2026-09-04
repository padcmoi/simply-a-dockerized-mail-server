<script setup lang="ts">
// A chart with its scale, its graduation and an answer when you point at it. The
// axis labels sit ON the plot rather than in a gutter beside it: a column of 56
// pixels for two short figures took a fifth of the width away from the curve,
// which is the thing anyone came to look at.
//
// Up to nine curves. They are either told apart by hue (the load's three
// windows, the verdicts of rspamd, the queues of Postfix) or by their own label
// (in and out); the ramp is kept for curves that are one thing at several
// depths. Every curve is named where it is read, so identity never rests on
// colour alone.

/** The nine hues a chart can tell curves apart with, each a colour the app
 *  already has, so a curve follows the theme like everything else on the page.
 *  Literal classes, so the stylesheet carries them. */
const HUES = {
  primary: { line: "stroke-primary", dot: "bg-primary", width: 2 },
  warning: { line: "stroke-warning", dot: "bg-warning", width: 2 },
  error: { line: "stroke-error", dot: "bg-error", width: 2 },
  success: { line: "stroke-success", dot: "bg-success", width: 2 },
  info: { line: "stroke-info", dot: "bg-info", width: 2 },
  secondary: { line: "stroke-secondary", dot: "bg-secondary", width: 2 },
  inverted: { line: "stroke-inverted", dot: "bg-inverted", width: 2 },
  toned: { line: "stroke-toned", dot: "bg-toned", width: 2 },
  dimmed: { line: "stroke-dimmed", dot: "bg-dimmed", width: 2 },
} as const;

type Hue = keyof typeof HUES;

/** The hues in the order a chart deals them out when a card names none. */
const HUE_ORDER = Object.keys(HUES) as Hue[];

const {
  series,
  max,
  maxLabel,
  minLabel = "0",
  legend = [],
  names = [],
  format = (value: number) => value.toFixed(2),
  area = false,
  at = [],
  variant = "ramp",
  colors = [],
  live = false,
} = defineProps<{
  /** Up to nine curves; for the ramp, in the order it reads: first is the
   *  loudest. A null is a moment with no figure, and the curve is cut rather
   *  than drawn through it. */
  series: (number | null)[][];
  /** The ceiling the curves are drawn against. */
  max: number;
  /** What that ceiling is, written on the plot. */
  maxLabel: string;
  minLabel?: string;
  /** Names each curve under the chart, with its current value. */
  legend?: string[];
  /** Names each curve in the tooltip, without it. */
  names?: string[];
  /** Writes a value the way its card writes it. */
  format?: (_value: number) => string;
  /** Fills under the first curve, for the ones that stand alone. */
  area?: boolean;
  /** The moment of every point, in epoch milliseconds, in the order drawn. */
  at?: number[];
  /** `series` gives each curve its own hue; `ramp` steps one hue for ordered ones. */
  variant?: "ramp" | "series";
  /** One hue per curve, for curves that already wear one elsewhere on the
   *  site (a verdict on the rspamd page, a queue on the Postfix page); wins
   *  over `variant`. */
  colors?: Hue[];
  /** Points still arriving: the plot walks left instead of jumping a step. */
  live?: boolean;
}>();

// One hue at nine steps, for curves that are the same measurement at different
// depths, where nine hues would claim a difference in kind that is not there.
const RAMP = [
  { line: "stroke-primary", dot: "bg-primary", width: 2 },
  { line: "stroke-primary opacity-70", dot: "bg-primary opacity-70", width: 1.75 },
  { line: "stroke-primary opacity-45", dot: "bg-primary opacity-45", width: 1.5 },
  { line: "stroke-primary opacity-40", dot: "bg-primary opacity-40", width: 1.5 },
  { line: "stroke-primary opacity-35", dot: "bg-primary opacity-35", width: 1.5 },
  { line: "stroke-primary opacity-30", dot: "bg-primary opacity-30", width: 1.5 },
  { line: "stroke-primary opacity-25", dot: "bg-primary opacity-25", width: 1.5 },
  { line: "stroke-primary opacity-20", dot: "bg-primary opacity-20", width: 1.5 },
  { line: "stroke-primary opacity-15", dot: "bg-primary opacity-15", width: 1.5 },
];

// One hue each, for when the curves have to be told apart at a glance rather
// than read as a progression: the nine of HUES, dealt in order.
const CATEGORICAL = HUE_ORDER.map((hue) => HUES[hue]);

const { locale } = useI18n();

const plot = useTemplateRef<HTMLDivElement>("plot");
const hovered = ref<number | null>(null);

// The dictionaries are named fr_FR here and fr-FR in Intl, which is the only
// thing standing between the app's locale and a date written the reader's way.
const tag = computed(() => locale.value.replace("_", "-"));

// The fill has to fade out downwards: a flat wash under a curve that barely
// moves, which is what memory does, is a slab that hides the baseline.
const gradient = useId();

const palette = computed(() => (colors.length ? colors.map((hue) => HUES[hue]) : variant === "series" ? CATEGORICAL : RAMP));
const count = computed(() => series[0]?.length ?? 0);

// A live plot is laid out one step wider than its box and walked left over the
// interval its samples arrive at, so it never jumps a step a second. See
// useMetricWalk: everything below simply reads the geometry that implies.
const { walks, step, stride, curve, labels } = useMetricWalk({
  at: () => at,
  count: () => count.value,
  live: () => live,
  frozen: () => hovered.value !== null,
});

const scale = computed(() => metricChartScale(count.value, max, CHART.width + step.value));

const paths = computed(() => metricPaths(series, scale.value));
const areas = computed(() => metricAreas(paths.value[0] ?? [], scale.value));

const window = computed(() => axisWindow(at));
const ticks = computed(() => axisTicks(window.value, tag.value, 100 + stride.value));

// What the crosshair is showing, if anything: where it sits across the plot, and
// every curve's value there.
const reading = computed(() => {
  const index = hovered.value;
  if (index === null || index >= count.value) return null;

  const values = series
    .map((curve, position) => ({
      name: names[position] ?? "",
      dot: palette.value[position]?.dot,
      value: curve[index] ?? null,
    }))
    .filter((mark) => mark.value !== null);

  // Nothing was recorded at that moment: no crosshair either, because a tooltip
  // carrying only a time would say "here is a figure" about a hole.
  if (!values.length) return null;

  return {
    left: positionOf(index),
    // The pointer stays the precise instrument: it lands on a point of the
    // window rather than on a graduation of the axis, so it carries the seconds
    // where the axis carries the minute.
    moment: window.value && at[index] !== undefined ? axisClock(at[index] as number, tag.value, window.value.scale, true) : "",
    values: values.map((mark) => ({ ...mark, top: (scale.value.y(mark.value as number) / CHART.height) * 100 })),
  };
});

/** Where a point rests across the plot, in percent: the walk has already
 *  carried it one step left by the time anything can be pointed at. */
function positionOf(index: number) {
  if (walks.value) return ((index - 1) / (count.value - 2)) * 100;
  return count.value > 1 ? (index / (count.value - 1)) * 100 : 0;
}

// Pointer events rather than mouse ones: the same handler answers a finger on a
// tablet.
function track(event: PointerEvent) {
  const box = plot.value?.getBoundingClientRect();
  if (!box || box.width === 0 || count.value < 2) return;

  const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  const index = walks.value ? Math.round(ratio * (count.value - 2)) + 1 : Math.round(ratio * (count.value - 1));
  hovered.value = Math.min(count.value - 1, index);
}
</script>

<template>
  <div class="space-y-1.5">
    <!-- Out to the card's own edges: the negative margin cancels the body
         padding, which is the only thing between the curve and the full width. -->
    <div
      ref="plot"
      class="relative -mx-4 touch-none text-primary sm:-mx-6"
      @pointermove="track"
      @pointerdown="track"
      @pointerleave="hovered = null"
      @pointercancel="hovered = null"
    >
      <svg
        class="block h-44 w-full"
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient :id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Everything that is the curve walks together; the crosshair below
             does not, since it marks where the pointer is, not where time is. -->
        <g :style="curve">
          <template v-if="area">
            <path v-for="(fill, index) in areas" :key="`area-${index}`" :d="fill" :fill="`url(#${gradient})`" />
          </template>

          <template v-for="(fragments, index) in paths" :key="index">
            <path
              v-for="(fragment, piece) in fragments"
              :key="piece"
              :d="fragment.path"
              :class="palette[index]?.line"
              :stroke-width="palette[index]?.width"
              fill="none"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </template>
        </g>

        <line
          v-if="reading"
          :x1="(reading.left / 100) * CHART.width"
          :x2="(reading.left / 100) * CHART.width"
          y1="0"
          :y2="CHART.height"
          class="stroke-inverted opacity-60"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- The scale, on the plot rather than beside it. -->
      <span class="absolute top-0 left-4 text-[10px] leading-none text-dimmed sm:left-6">{{ maxLabel }}</span>
      <span class="absolute bottom-1 left-4 text-[10px] leading-none text-dimmed sm:left-6">{{ minLabel }}</span>
      <!-- The baseline, full width, one shade off the surface. -->
      <span class="absolute inset-x-0 bottom-0 h-px bg-accented" />

      <!-- Round marks have to be HTML: the plot is stretched to the card's
           width, which would turn a circle drawn in it into an ellipse. -->
      <template v-if="reading">
        <span
          v-for="(mark, index) in reading.values"
          :key="index"
          class="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-default"
          :class="mark.dot"
          :style="{ left: `${reading.left}%`, top: `${mark.top}%` }"
        />

        <div
          class="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md bg-inverted px-2 py-1.5 text-xs whitespace-nowrap text-inverted shadow-lg"
          :style="{ left: `${Math.min(82, Math.max(18, reading.left))}%` }"
        >
          <p class="mb-0.5 opacity-70">{{ reading.moment }}</p>
          <p v-for="(mark, index) in reading.values" :key="index" class="flex items-center gap-1.5">
            <span class="size-1.5 shrink-0 rounded-full" :class="mark.dot" />
            <span v-if="mark.name" class="opacity-70">{{ mark.name }}</span>
            <span class="font-medium">{{ format(mark.value as number) }}</span>
          </p>
        </div>
      </template>
    </div>

    <!-- The graduation, under the moment it marks. Absolutely placed rather than
         spaced by a flexbox: a time has to sit where it is, not where an even
         distribution would put it. -->
    <MetricAxis :marks="ticks" :walk="labels" />

    <ul v-if="legend.length" class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dimmed">
      <li v-for="(name, index) in legend" :key="name" class="flex items-center gap-1.5">
        <span class="size-1.5 shrink-0 rounded-full" :class="palette[index]?.dot" />
        {{ name }}
      </li>
    </ul>
  </div>
</template>
