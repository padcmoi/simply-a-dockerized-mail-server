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
