import { useIdle } from "@vueuse/core";

const IDLE_AFTER_MS = 30_000;

// Reports keyboard/mouse idleness to the server so an account sitting untouched
// in front of an open tab shows offline, like a disconnection. The server flips
// it back the instant activity resumes. The state is re-announced on every
// (re)connection, since a fresh socket starts assumed active.
export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const { idle } = useIdle(IDLE_AFTER_MS);

  function announce() {
    if (auth.session) realtimeSend("activity", { idle: idle.value });
  }

  watch(idle, announce);
  onRealtimeOpen(announce);
});
