import { AccountPresenceService } from "../account-presence.service";
import { Watcher } from "../watcher.type";

// Who is online right now, plus when the offline ones were last seen. Every
// authenticated account may read it (authorize returns true): it reveals
// presence, nothing more, no session, ip, agent or email. Each consumer maps
// the ids to the people it already sees (its thread, its session list).
export function presenceWatcher(presence: AccountPresenceService): Watcher {
  return {
    topic: "presence",
    permissions: [],
    intervalMs: 5_000,
    authorize: () => Promise.resolve(true),
    fn: () => presence.presenceState(),
  };
}
