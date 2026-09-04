import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

// Who is acting and from where, for the activity log, without threading an ip
// and a user agent through every service signature that writes a line. The
// express middleware opens one store per request; a service reading the store
// while handling that request sees its ip, its user agent and, once the auth
// guard has set it, its account. Outside a request (a scheduler, a test) there
// is no store, and a line is written with none of the three.
export interface ActivityContext {
  ip: string | null;
  userAgent: string | null;
  actorId: () => string | null;
}

const storage = new AsyncLocalStorage<ActivityContext>();

type UserRequest = Request & { user?: { id?: string } };

export function activityContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userAgent = req.headers["user-agent"];
  storage.run(
    {
      ip: req.ip ?? null,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
      actorId: () => (req as UserRequest).user?.id ?? null,
    },
    next
  );
}

export function currentActivityContext() {
  return storage.getStore() ?? null;
}
