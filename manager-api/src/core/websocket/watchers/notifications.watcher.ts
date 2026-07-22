import { NotificationsService } from "../../notifications/notifications.service";
import { Watcher } from "../watcher.type";

export function notificationsWatcher(notifications: NotificationsService): Watcher {
  return {
    topic: "notifications",
    scope: "self",
    parameterized: true,
    permissions: [],
    intervalMs: 2_000,
    fn: (param) => notifications.feed(String(param)),
  };
}
