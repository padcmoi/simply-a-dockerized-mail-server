import { Injectable } from "@nestjs/common";

// Per-socket activity, fed by the gateway. A live session keeps an account
// "online" in the database, but a person who has not touched their keyboard is
// away even with the tab open: the client reports idle over the socket, and
// presence subtracts anyone whose every socket has gone idle.
@Injectable()
export class PresenceActivityService {
  private readonly byUser = new Map<string, Map<object, boolean>>();

  join(userId: string, socket: object) {
    const sockets = this.byUser.get(userId) ?? new Map<object, boolean>();
    sockets.set(socket, true);
    this.byUser.set(userId, sockets);
  }

  setActive(userId: string, socket: object, active: boolean) {
    const sockets = this.byUser.get(userId);
    if (sockets?.has(socket)) sockets.set(socket, active);
  }

  leave(userId: string, socket: object) {
    const sockets = this.byUser.get(userId);
    if (!sockets) return;
    sockets.delete(socket);
    if (!sockets.size) this.byUser.delete(userId);
  }

  // Someone is present when they hold a socket that is not idle. No socket at
  // all means gone, which is the same thing to a reader.
  isActive(userId: string): boolean {
    const sockets = this.byUser.get(userId);
    return !!sockets && [...sockets.values()].some(Boolean);
  }

  // Accounts that hold at least one socket, none of them active: present on the
  // wire but idle in front of the screen, so shown as offline.
  awayUserIds(): Set<string> {
    const away = new Set<string>();
    for (const [userId, sockets] of this.byUser) {
      if (sockets.size && ![...sockets.values()].some(Boolean)) away.add(userId);
    }
    return away;
  }
}
