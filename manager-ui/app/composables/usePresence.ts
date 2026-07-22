// Live presence over the websocket, readable by any signed-in account. The
// server pushes only account ids, so callers map them to whoever they already
// display (a support thread, a session list) without leaking anything more.
export function usePresence() {
  const pushed = useRealtimeTopic<string[]>("presence");
  const online = computed(() => new Set(pushed.value ?? []));

  function isOnline(accountId: string | null | undefined) {
    return !!accountId && online.value.has(accountId);
  }

  return { online, isOnline };
}
