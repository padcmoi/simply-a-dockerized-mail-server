// Live presence over the websocket, readable by any signed-in account. The
// server pushes only account ids, so callers map them to whoever they already
// display (a support thread, a session list) without leaking anything more.
interface PresenceState {
  online: string[];
  lastSeen: Record<string, string>;
}

export function usePresence() {
  const pushed = useRealtimeTopic<PresenceState>("presence");
  const online = computed(() => new Set(pushed.value?.online ?? []));

  function isOnline(accountId: string | null | undefined) {
    return !!accountId && online.value.has(accountId);
  }

  // When an offline account was last there. Null while online, or for someone
  // who has never connected.
  function lastSeenAt(accountId: string | null | undefined) {
    return (accountId && pushed.value?.lastSeen[accountId]) || null;
  }

  return { online, isOnline, lastSeenAt };
}
