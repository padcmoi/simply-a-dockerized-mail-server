import { useActiveElement, useWindowFocus as useVueWindowFocus } from "@vueuse/core";
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

function isEditing(el: Element | null | undefined) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  const role = el.getAttribute("role");
  return (
    role === "checkbox" ||
    role === "switch" ||
    role === "radio" ||
    role === "textbox" ||
    role === "combobox" ||
    role === "menuitemcheckbox" ||
    role === "menuitemradio" ||
    role === "spinbutton"
  );
}

export function useHeartbeatStatus() {
  const editing = useState("heartbeat-editing", () => false);
  return { editing };
}

export function useFocusHeartbeat() {
  const { bump } = useDataRefresh();
  const { editing } = useHeartbeatStatus();
  const focused = useVueWindowFocus();
  const activeElement = useActiveElement();
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
    [focused, activeElement],
    ([isFocused, el]) => {
      editing.value = isFocused && isEditing(el);
      if (isFocused && !editing.value) start();
      else stop();
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    stop();
    editing.value = false;
  });
}
