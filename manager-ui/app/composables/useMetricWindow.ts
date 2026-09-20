import type { Ref } from "vue";

// How often a window is asked for again. It is the width of one of its own
// points: an hour is drawn in minutes, so a request a minute is exactly one new
// column, and asking a week every minute would be eighty-four identical answers
// an hour.
//
// Counted on the clock and never from the click: the recorded buckets are
// themselves `FLOOR(at / step) * step`, so the refresh lands where the samples
// do, at the minute and at the half hour, and the same second whichever card
// was clicked, whenever the page was opened and in whichever tab.
const REFRESH_MS = { hour: 60_000, day: 300_000, week: 1_800_000 };

// Asked a moment after the turn rather than on it. A bucket is cut on the clock
// and the recorder writes one row every ten seconds, so the bucket that opens on
// the turn is still empty at that very second and the window would come back one
// column short of now. Past this, it holds a row, and every refresh carries the
// newest point the recorder has.
const SETTLE_MS = 12_000;

// The settle shifts the whole grid rather than being added to the next turn:
// added, a window opened in the first seconds of a minute would wait that
// minute plus the settle, more than the interval it promises, and two refreshes
// would sit further apart than one of its own points.
function nextTurnOf(every: number) {
  const settled = Date.now() - SETTLE_MS;
  return Math.floor(settled / every) * every + every + SETTLE_MS;
}

/** The windows a card can be drawn over, in the order the tags read them. */
export const SUPERVISION_WINDOWS: readonly MetricRange[] = ["week", "day", "hour", "minute"];

// Where a card's curve comes from, for the window it is set to. The live minute
// is the socket's own history, nothing else is that fresh, and the three longer
// ones are the recorded samples aggregated by the API. The header of the card
// stays live either way: what the machine is doing now is a fact about now,
// whatever window the curve happens to be drawn over.
export function useMetricWindow(range: Ref<MetricRange>, live: () => HistoryPoint[], paused?: Ref<boolean>) {
  const { t } = useI18n();
  const { call } = useApi();

  const stored = ref<HistoryPoint[]>([]);
  const loading = ref(false);
  const failed = ref(false);

  // What the curves stand on while the pause holds. The feed is left alone: the
  // headers keep reading what the machine is doing now, and everything that
  // arrived under the pause is on screen the moment it is lifted, rather than a
  // hole where the paused seconds were.
  const held = ref<HistoryPoint[] | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;

  // When the next request is due, and the second it is read against. The badge
  // counts down the very moment the window is asked for again and never a
  // second copy of it. Null on the live minute, which has nothing to wait for.
  const dueAt = ref(0);
  const now = ref(0);

  const nextRefresh = computed(() => (dueAt.value ? Math.max(0, Math.round((dueAt.value - now.value) / 1000)) : null));

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
    if (timer) clearTimeout(timer);
    if (ticker) clearInterval(ticker);
    timer = null;
    ticker = null;
    dueAt.value = 0;
    if (range.value === "minute") return;

    const every = REFRESH_MS[range.value];

    // Waited out one turn at a time rather than on a repeating interval: the
    // turn is aimed at a moment of the clock, and a browser that held the timers
    // back while the tab was in the background would otherwise stay off by
    // whatever it kept.
    const wait = () => {
      dueAt.value = nextTurnOf(every);
      timer = setTimeout(() => {
        void load();
        wait();
      }, dueAt.value - Date.now());
    };

    now.value = Date.now();
    wait();
    ticker = setInterval(() => (now.value = Date.now()), 1000);
  }

  watch(range, () => {
    stored.value = [];
    failed.value = false;
    // Another window is another set of points entirely: it is drawn as it
    // arrives, then held in turn, instead of the pause showing the minute that
    // was on screen under the axis of a week.
    held.value = null;
    void load();
    schedule();
  });

  onMounted(() => {
    void load();
    schedule();
  });

  onScopeDispose(() => {
    if (timer) clearTimeout(timer);
    if (ticker) clearInterval(ticker);
  });

  const current = computed(() => (range.value === "minute" ? live() : stored.value));
  const points = computed(() => held.value ?? current.value);

  if (paused) {
    watch(paused, (on) => {
      held.value = on ? current.value : null;
    });

    // A window asked for under the pause has nothing to hold until its answer
    // lands, so the first points that come are what the pause keeps.
    watch(current, (value) => {
      if (paused.value && !held.value?.length) held.value = value;
    });
  }

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

  return { points, at, notice, loading, failed, nextRefresh };
}
