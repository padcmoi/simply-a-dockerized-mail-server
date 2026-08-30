import { CHART } from "~/utils/metricChart";

/** Past this cadence a chart is not being watched arriving, it is being read. */
const WALKABLE_MS = 4_000;

// A curve that gains a point a second and is redrawn in place jumps a step a
// second, which reads as a stutter rather than as a machine being watched.
//
// So the plot is laid out one step wider than its box, with the newest sample
// just past the right edge, and the whole thing is walked left by that step over
// the interval the samples arrive at. It lands exactly as the next one does,
// which is what makes it look like it never stops: the reset happens on the
// frame the new point is drawn, at the position the walk had just reached, so
// there is nothing to see at the seam.
export function useMetricWalk({ at, count, live, frozen }: Walking) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  // How far apart the last two samples were, which is how long the walk has to
  // take: arriving early leaves it standing still for the remainder, and that
  // pause is the only thing the eye would see.
  const cadence = computed(() => {
    const moments = at();
    const last = moments[moments.length - 1];
    const previous = moments[moments.length - 2];
    return last !== undefined && previous !== undefined ? last - previous : 0;
  });

  const walks = computed(() => live() && count() > 2 && cadence.value > 0 && cadence.value <= WALKABLE_MS && !reduced.value);

  /** One sample, in the plot's own units. */
  const step = computed(() => (walks.value ? CHART.width / (count() - 2) : 0));
  /** The same, in percent, for anything placed against the box instead. */
  const stride = computed(() => (walks.value ? 100 / (count() - 2) : 0));

  /** Where the walk stands; null is its resting end, one step to the left. */
  const walked = ref<number | null>(null);
  const walking = ref(false);

  const transition = computed(() => (walking.value ? `transform ${cadence.value}ms linear` : "none"));

  const curve = computed(() => ({
    transform: `translateX(${walked.value ?? -step.value}px)`,
    transition: transition.value,
  }));

  // The graduation walks with the curve and not against its own box: a mark and
  // the moment of the curve it names have to travel together, or the times jump
  // every time the line does not.
  const labels = computed(() => ({
    transform: `translateX(${walked.value === null ? -stride.value : 0}%)`,
    transition: transition.value,
  }));

  watch(
    () => at()[at().length - 1],
    (moment, previous) => {
      // A frame loop is what the walk is timed against, and a render with no
      // browser under it has none: there, the chart is simply drawn at rest.
      if (typeof requestAnimationFrame !== "function" || !walks.value) return;
      if (moment === undefined || previous === undefined || moment === previous) return;

      walking.value = false;
      if (frozen()) return (walked.value = null);

      // Back to where the walk started, without a transition, on the same frame
      // the new point is drawn: the sample that was there is now one index
      // earlier, so nothing moves. Then two frames later, once that has been
      // painted, the walk is started again.
      walked.value = 0;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          walking.value = !frozen();
          walked.value = null;
        })
      );
    }
  );

  return { walks, step, stride, curve, labels };
}
