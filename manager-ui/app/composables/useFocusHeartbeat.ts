import { useWindowFocus as useVueWindowFocus } from "@vueuse/core";
import { useDataRefresh } from "~/composables/useDataRefresh";

const FAST_MS = 5_000;
const SLOW_MS = 30_000;

type NetworkInformation = { effectiveType?: string; saveData?: boolean };

function intervalMs() {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return FAST_MS;
  if (conn.saveData) return SLOW_MS;
  const t = conn.effectiveType;
  return t === "slow-2g" || t === "2g" || t === "3g" ? SLOW_MS : FAST_MS;
}

export function useFocusHeartbeat() {
  const { bump } = useDataRefresh();
  const focused = useVueWindowFocus();
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();

    if (!import.meta.client) return;

    console.info("BUMP !");

    timer = setInterval(bump, intervalMs());
  }

  watch(
    focused,
    (isFocused) => {
      if (isFocused) start();
      else stop();
    },
    { immediate: true }
  );

  onScopeDispose(stop);
}
