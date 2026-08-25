import { Injectable } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ApiTokenAccessService } from "./api-token-access.service";
import { normalizeIp, parseApiKey } from "./api-token.request";

function headerOf(req: Request, name: string): string {
  const value = req.headers[name];
  return typeof value === "string" ? value : "";
}

@Injectable()
export class ApiTokenAccessMiddleware implements NestMiddleware {
  constructor(private readonly access: ApiTokenAccessService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const rawKey = req.headers["x-api-key"];
    const parsed = typeof rawKey === "string" ? parseApiKey(rawKey) : null;
    if (!parsed) {
      next();
      return;
    }

    const startedAt = Date.now();
    res.on("finish", () => {
      this.access.record({
        clientId: parsed.clientId,
        method: req.method,
        route: req.originalUrl,
        statusCode: res.statusCode,
        clientIp: normalizeIp(req.ip ?? ""),
        userAgent: headerOf(req, "user-agent"),
        origin: headerOf(req, "origin"),
        referer: headerOf(req, "referer"),
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  }
}
