export interface SystemSnapshot {
  /** Epoch milliseconds, read on the host that sampled it. */
  at: number;
  cores: number;
  cpu: number | null;
  load: { one: number; five: number; fifteen: number };
  memory: { total: number; used: number };
  network: { interface: string; in: number | null; out: number | null } | null;
}

// One point's worth of what the curves draw, as percentages except the load.
// Every figure can be null and each null means something different: a CPU that
// needs two readings and has had one, a network the host will not report, or, on
// the recorded windows, a moment nothing was written for. They are kept rather
// than dropped so that a point stays where its moment is.
export interface HistoryPoint {
  at: number;
  cpu: number | null;
  memory: number | null;
  load: [number, number, number] | null;
  /** Bytes per second, in then out. */
  network: [number, number] | null;
}

export type MetricsStatus = "connecting" | "live" | "offline";

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
  const { at, cpu, load, memory, network } = frame;

  const point: HistoryPoint = {
    at,
    cpu,
    memory: memory.total > 0 ? (memory.used / memory.total) * 100 : 0,
    load: [load.one, load.five, load.fifteen],
    network: network && network.in !== null && network.out !== null ? [network.in, network.out] : null,
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
      const { snapshot: latest, points } = await call<{ snapshot: SystemSnapshot | null; points: SystemSnapshot[] }>(
        "/supervision/live"
      );
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

  return { snapshot, history, status, pending, load };
}
