import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Controller, Get, MiddlewareConsumer, Module, NestModule, UnauthorizedException, CanActivate } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { ApiTokenAccessMiddleware } from "../../src/core/auth/api-token/api-token-access.middleware";
import { ApiTokenAccessService } from "../../src/core/auth/api-token/api-token-access.service";

const KEY = "sms_cid.s3cret";

@Controller({ path: "probe", version: "1" })
class ProbeController {
  @Get()
  ok() {
    return { ok: true };
  }

  @Get("closed")
  closed() {
    return { ok: true };
  }
}

class RefuseClosedGuard implements CanActivate {
  canActivate(context: { switchToHttp: () => { getRequest: () => { originalUrl: string } } }) {
    if (context.switchToHttp().getRequest().originalUrl.includes("closed")) throw new UnauthorizedException();
    return true;
  }
}

describe("ApiTokenAccessMiddleware", () => {
  let app: INestApplication;
  const access = { record: vi.fn() };

  beforeEach(async () => {
    access.record.mockClear();

    @Module({
      controllers: [ProbeController],
      providers: [
        ApiTokenAccessMiddleware,
        { provide: ApiTokenAccessService, useValue: access },
        { provide: APP_GUARD, useClass: RefuseClosedGuard },
      ],
    })
    class ProbeModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(ApiTokenAccessMiddleware).forRoutes("*");
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(() => app.close());

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("records who, from where, which url and when", async () => {
    await request(app.getHttpServer())
      .get("/api/probe")
      .set("x-api-key", KEY)
      .set("user-agent", "python-requests/2.32.3")
      .set("origin", "https://tools.example.org")
      .expect(200);
    await settle();

    expect(access.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "cid",
        method: "GET",
        route: "/api/probe",
        statusCode: 200,
        userAgent: "python-requests/2.32.3",
        origin: "https://tools.example.org",
      })
    );
  });

  it("keeps the query string of the url that was asked for", async () => {
    await request(app.getHttpServer()).get("/api/probe?limit=10&offset=20").set("x-api-key", KEY).expect(200);
    await settle();

    expect(access.record).toHaveBeenCalledWith(expect.objectContaining({ route: "/api/probe?limit=10&offset=20" }));
  });

  it("records a request a guard refused, which no interceptor would have seen", async () => {
    await request(app.getHttpServer()).get("/api/probe/closed").set("x-api-key", KEY).expect(401);
    await settle();

    expect(access.record).toHaveBeenCalledWith(expect.objectContaining({ route: "/api/probe/closed", statusCode: 401 }));
  });

  it("ignores a request carrying no api key", async () => {
    await request(app.getHttpServer()).get("/api/probe").expect(200);
    await settle();

    expect(access.record).not.toHaveBeenCalled();
  });

  it("ignores a header that is not one of our keys", async () => {
    await request(app.getHttpServer()).get("/api/probe").set("x-api-key", "bearer-something").expect(200);
    await settle();

    expect(access.record).not.toHaveBeenCalled();
  });
});
