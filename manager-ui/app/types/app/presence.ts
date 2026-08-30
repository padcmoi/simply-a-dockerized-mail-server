// Who is online, as the presence feed reports it.

// Live presence over the websocket, readable by any signed-in account. The
// server pushes only account ids, so callers map them to whoever they already
// display (a support thread, a session list) without leaking anything more.
export interface PresenceState {
  online: string[];
  lastSeen: Record<string, string>;
}
