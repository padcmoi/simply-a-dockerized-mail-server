import { useActiveElement, useWindowFocus as useVueWindowFocus } from "@vueuse/core";
import { useDataRefresh } from "~/composables/useDataRefresh";

const FAST_MS = 15_000;
const SLOW_MS = 30_000;

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
  return role === "textbox" || role === "spinbutton";
}

// A select or a menu whose list is OPEN. That is the moment a reload does damage: the
// options are rebuilt under the pointer while somebody is choosing one.
//
// It cannot be read off the active element, and that is the difficulty: Reka UI moves
// the focus INTO the popup when it opens, so the trigger carrying the state is no
// longer the focused node. The document is asked instead, on every focus change, which
// is exactly when a popup opens and when it closes.
//
// Matched on a trigger that both owns a popup and declares it expanded, rather than on
// `aria-expanded` alone: a nav section left unfolded also carries that attribute, and
// it would pause the heartbeat for as long as it stayed open.
function popupOpen() {
  if (!import.meta.client) return false;
  return document.querySelector('[role="combobox"][aria-expanded="true"], [aria-haspopup][aria-expanded="true"]') !== null;
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
      editing.value = isFocused && (isEditing(el) || popupOpen());
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
