import { SHIPPED_THRESHOLDS, type MetricThresholds } from "~/utils/metrics";

// Sixty-one points at one a second is sixty intervals, so the axis reads exactly
// 60 s and not the 70 s of a list sized by eye. One list for all the curves
// rather than one each, so they cannot drift apart.
const LIVE_POINTS = 61;

// Frames arrive every second. Past this the feed is treated as gone even though
// nothing closed it: a socket held open by a proxy in front of a server that
// stopped answering is exactly the case a badge reading "live" must not survive.
// Eight missed frames rather than four, so a busy moment does not flip the badge.
const STALE_MS = 8_000;
const CLOCK_MS = 1_000;

export function pointOf(frame: SystemSnapshot) {
  const { at, cpu, load, memory, network, rspamd, postfix } = frame;

  const point: HistoryPoint = {
    at,
    cpu,
    memory: memory.total > 0 ? (memory.used / memory.total) * 100 : 0,
    load: [load.one, load.five, load.fifteen],
    network: network && network.in !== null && network.out !== null ? [network.in, network.out] : null,
    rspamd: rspamd ? [rspamd.scanned, rspamd.noAction, rspamd.greylist, rspamd.addHeader, rspamd.reject, rspamd.learned] : null,
    postfix: postfix ? [postfix.active, postfix.deferred, postfix.hold, postfix.incoming] : null,
  };

  return point;
}

// The live minute of the machine. The window the page opens on comes from the
// API, because the sampling loop has been running since boot and that minute
// already exists: waiting for the socket to fill it would be a minute of
// watching a line crawl in from the left. Everything after it arrives on the
// realtime topic, one frame every two seconds, sampled once for every watcher.
export function useSystemMetrics() {
  const { call } = useApi();

  const snapshot = ref<SystemSnapshot | null>(null);
  // What the API paints its red with, and what it notifies on: the same numbers,
  // so a card and a notification cannot say different things about one host.
  // Until it answers, the ones the interface ships with.
  const thresholds = ref<MetricThresholds>(SHIPPED_THRESHOLDS);
  const history = ref<HistoryPoint[]>([]);
  const pending = ref(true);
  const lastFrameAt = ref(0);
  const now = ref(Date.now());

  function apply(frame: SystemSnapshot) {
    if (snapshot.value && frame.at <= snapshot.value.at) return;
    snapshot.value = frame;
    history.value = [...history.value, pointOf(frame)].slice(-LIVE_POINTS);
    lastFrameAt.value = Date.now();
  }

  async function load() {
    try {
      const {
        snapshot: latest,
        points,
        thresholds: served,
      } = await call<{ snapshot: SystemSnapshot | null; points: SystemSnapshot[]; thresholds?: MetricThresholds }>(
        "/supervision/live"
      );
      if (served) thresholds.value = served;
      if (latest) {
        history.value = points.map(pointOf).slice(-LIVE_POINTS);
        snapshot.value = latest;
        lastFrameAt.value = Date.now();
      }
    } catch {
      // A refused window is a feed that is away, which the badge already says.
      // The topic keeps pushing either way, and the first frame fills the cards.
    } finally {
      pending.value = false;
    }
  }

  const frame = useRealtimeTopic<SystemSnapshot>("supervision-machine");
  watch(frame, (value) => {
    if (value) apply(value);
  });

  onMounted(() => {
    void load();
  });

  // The refresh button of the header re-seeds the window from the API rather
  // than doing nothing on this page: a feed that was away comes back with its
  // whole minute instead of one point every two seconds.
  watch(useDataRefresh().tick, () => void load());

  useIntervalFn(() => {
    now.value = Date.now();
  }, CLOCK_MS);

  // Never back to "connecting" once figures are on screen: they are held, dimmed
  // by the panel, rather than replaced by a skeleton that flashes whenever the
  // socket blinks.
  const status = computed<MetricsStatus>(() => {
    if (!snapshot.value) return pending.value ? "connecting" : "offline";
    return now.value - lastFrameAt.value < STALE_MS ? "live" : "offline";
  });

  return { snapshot, history, status, pending, thresholds, load };
}
