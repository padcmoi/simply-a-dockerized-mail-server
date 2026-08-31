import { TicketsService } from "../../../api/tickets/tickets.service";
import { Watcher } from "../watcher.type";

export function ticketThreadWatcher(tickets: TicketsService): Watcher {
  return {
    topic: "ticket",
    parameterized: true,
    permissions: [],
    intervalMs: 1_000,
    authorize: (caller, param) => {
      const id = Number(param);
      return Number.isFinite(id) ? tickets.canWatch(id, caller) : Promise.resolve(false);
    },
    fn: (param) => tickets.thread(Number(param)),
  };
}
