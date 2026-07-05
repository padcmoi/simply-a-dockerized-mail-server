// Shared tick bumped whenever the session/permissions get re-verified
// (window focus regained, tab becomes visible again — see useWindowFocus.ts /
// useSessionRefresh.ts). Pages that load their own data on mount watch this
// tick to reload that data too: refreshing the session without refreshing
// what's on screen leaves stale data under (possibly changed) rights.
export function useDataRefresh() {
  const tick = useState("data-refresh-tick", () => 0);
  function bump() {
    tick.value++;
  }
  return { tick, bump };
}
