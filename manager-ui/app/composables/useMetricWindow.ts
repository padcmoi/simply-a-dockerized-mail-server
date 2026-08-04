import type { HistoryPoint } from "./useSystemMetrics";

export type MetricRange = "minute" | "hour" | "day" | "week";

// How often a window is asked for again. It is the width of one of its own
// points: an hour is drawn in minutes, so a request a minute is exactly one new
// column, and asking a week every minute would be eighty-four identical answers
// an hour.
const REFRESH_MS = { hour: 60_000, day: 300_000, week: 1_800_000 };

// Where a card's curve comes from, for the window it is set to. The live minute
// is the socket's own history, nothing else is that fresh, and the three longer
// ones are the recorded samples aggregated by the API. The header of the card
// stays live either way: what the machine is doing now is a fact about now,
// whatever window the curve happens to be drawn over.
export function useMetricWindow(range: Ref<MetricRange>, live: () => HistoryPoint[]) {
  const { t } = useI18n();
  const { call } = useApi();

  const stored = ref<HistoryPoint[]>([]);
  const loading = ref(false);
  const failed = ref(false);

  let timer: ReturnType<typeof setInterval> | null = null;

  async function load() {
    if (range.value === "minute") return;

    // Only the first pass says so: a refresh that redrew the card as a
    // placeholder every minute would flash a chart already on screen and still true.
    loading.value = !stored.value.length;
    const asked = range.value;

    try {
      const window = await call<{ points: HistoryPoint[] }>(`/supervision/history/${asked}`);
      // The window may have been changed while this was in flight, and the
      // answer to a question nobody is asking any more must not land on the card.
      if (asked !== range.value) return;

      stored.value = window.points;
      failed.value = false;
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  function schedule() {
    if (timer) clearInterval(timer);
    timer = null;
    if (range.value === "minute") return;

    timer = setInterval(() => void load(), REFRESH_MS[range.value]);
  }

  watch(range, () => {
    stored.value = [];
    failed.value = false;
    void load();
    schedule();
  });

  onMounted(() => {
    void load();
    schedule();
  });

  onScopeDispose(() => {
    if (timer) clearInterval(timer);
  });

  const points = computed(() => (range.value === "minute" ? live() : stored.value));

  // The moments the points cover, which is what the axis is written from. Epoch
  // milliseconds all the way from the host that read them: the page turns them
  // into clock times in the reader's own zone, and nothing on the way has to
  // know which zone that is.
  const at = computed(() => points.value.map((point) => point.at));

  // What to say in the space of the chart when there is no chart to draw. Never
  // a dash: each of these is a different thing to know, and one glyph for all of
  // them says none.
  const notice = computed(() => {
    if (range.value === "minute") return t("supervision.sampling");
    if (loading.value) return t("supervision.rangeLoading");
    if (failed.value) return t("supervision.rangeFailed");
    return t("supervision.rangeEmpty");
  });

  return { points, at, notice, loading, failed };
}
