import { JwtAuthService } from "../../auth/jwt/jwt.service";
import { PresenceActivityService } from "../presence-activity.service";
import { Watcher } from "../watcher.type";

// Who is online right now, as a bare list of account ids. Every authenticated
// account may read it (authorize returns true): it reveals presence, nothing
// more, no session, ip, agent or email. Each consumer maps the ids to the
// people it already sees (its support thread, its session list).
export function presenceWatcher(sessions: JwtAuthService, activity: PresenceActivityService): Watcher {
  return {
    topic: "presence",
    permissions: [],
    intervalMs: 5_000,
    authorize: () => Promise.resolve(true),
    fn: async () => {
      const online = await sessions.onlineAccountIds();
      const away = activity.awayUserIds();
      return online.filter((id) => !away.has(id));
    },
  };
}
