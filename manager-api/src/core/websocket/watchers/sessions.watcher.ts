import { JwtAuthService } from "../../auth/jwt/jwt.service";
import { Watcher } from "../watcher.type";

export function sessionsWatcher(sessions: JwtAuthService): Watcher {
  return {
    topic: "sessions-overview",
    permissions: [{ resource: "accounts", actions: ["access", "view-account-sessions"] }],
    fn: () => sessions.listSessionsOverview(),
  };
}
