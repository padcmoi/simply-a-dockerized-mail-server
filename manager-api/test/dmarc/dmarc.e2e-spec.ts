import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { DmarcController } from "../../src/api/dmarc/dmarc.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { DmarcService } from "../../src/core/dmarc/dmarc.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

type Method = "get" | "post" | "put";

const SETTINGS = {
  sendingEnabled: true,
  reportHour: 2,
  inboxes: ["dmarc@example.org"],
  retentionDays: 90,
};

const ACTIONS = ["view-dmarc-reports", "send-dmarc-reports", "import-dmarc-reports", "manage-dmarc-settings"];

const ROUTES: {
  name: string;
  method: Method;
  path: string;
  action: string;
  call: keyof typeof dmarc;
  status: number;
  body?: object;
}[] = [
  { name: "GET overview", method: "get", path: "/overview", action: "view-dmarc-reports", call: "overview", status: 200 },
  { name: "GET incoming", method: "get", path: "/incoming", action: "view-dmarc-reports", call: "listIncoming", status: 200 },
  {
    name: "GET incoming/:id",
    method: "get",
    path: "/incoming/3",
    action: "view-dmarc-reports",
    call: "incomingReport",
    status: 200,
  },
  {
    name: "GET incoming/:id/xml",
    method: "get",
    path: "/incoming/3/xml",
    action: "view-dmarc-reports",
    call: "incomingXml",
    status: 200,
  },
  { name: "GET outgoing", method: "get", path: "/outgoing", action: "view-dmarc-reports", call: "listOutgoing", status: 200 },
  {
    name: "GET outgoing/:id/xml",
    method: "get",
    path: "/outgoing/3/xml",
    action: "view-dmarc-reports",
    call: "outgoingXml",
    status: 200,
  },
  {
    name: "POST outgoing/run",
    method: "post",
    path: "/outgoing/run",
    action: "send-dmarc-reports",
    call: "runReports",
    status: 200,
    body: {},
  },
  {
    name: "POST outgoing/:id/retry",
    method: "post",
    path: "/outgoing/3/retry",
    action: "send-dmarc-reports",
    call: "retryOutgoing",
    status: 200,
  },
  { name: "GET inbox", method: "get", path: "/inbox", action: "view-dmarc-reports", call: "listInbox", status: 200 },
  {
    name: "POST inbox/scan",
    method: "post",
    path: "/inbox/scan",
    action: "import-dmarc-reports",
    call: "scanInbox",
    status: 200,
  },
  { name: "GET settings", method: "get", path: "/settings", action: "manage-dmarc-settings", call: "getSettings", status: 200 },
  {
    name: "PUT settings",
    method: "put",
    path: "/settings",
    action: "manage-dmarc-settings",
    call: "updateSettings",
    status: 200,
    body: SETTINGS,
  },
  { name: "GET mailboxes", method: "get", path: "/mailboxes", action: "manage-dmarc-settings", call: "mailboxes", status: 200 },
];

const dmarc = {
  overview: vi.fn(),
  listIncoming: vi.fn(),
  incomingReport: vi.fn(),
  incomingXml: vi.fn(),
  listOutgoing: vi.fn(),
  outgoingXml: vi.fn(),
  runReports: vi.fn(),
  retryOutgoing: vi.fn(),
  listInbox: vi.fn(),
  scanInbox: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  mailboxes: vi.fn(),
};

describe("DmarcController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const activity = { record: vi.fn() };
  const base = "/api/v1/dmarc";

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DmarcController],
      providers: [
        { provide: DmarcService, useValue: dmarc },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
    for (const fn of Object.values(dmarc)) fn.mockResolvedValue({ items: [], total: 0 });
    dmarc.runReports.mockResolvedValue({ day: "2026-09-20", domains: 1, sent: 1, failed: 0, skipped: 0, unchanged: 0 });
    dmarc.retryOutgoing.mockResolvedValue({
      id: 3,
      status: "sent",
      recipient: "dmarc@partner.example",
      reportId: "partner.example:1",
    });
    dmarc.scanInbox.mockResolvedValue({ mailboxes: 1, scanned: 2, imported: 1, duplicates: 0, ignored: 1, failed: 0 });
    dmarc.updateSettings.mockResolvedValue(SETTINGS);
    activity.record.mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const call = (method: Method, path: string, body?: object) => {
    const agent = api()[method](`${base}${path}`);
    return body ? agent.send(body) : agent;
  };
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  for (const route of ROUTES) {
    describe(route.name, () => {
      it("401 without a token", async () => {
        await call(route.method, route.path, route.body).expect(401);
      });
      it("401 with a garbage bearer token", async () => {
        await call(route.method, route.path, route.body).set("Authorization", "Bearer nope").expect(401);
      });
      it("403 for a user without the permission", async () => {
        await call(route.method, route.path, route.body).set("Authorization", auth(USER)).expect(403);
        expect(dmarc[route.call]).not.toHaveBeenCalled();
      });
      it(`403 for a user holding access and every action but ${route.action}`, async () => {
        h.cpg.grantGlobal("dmarc", "access", ...ACTIONS.filter((action) => action !== route.action));
        await call(route.method, route.path, route.body).set("Authorization", auth(USER)).expect(403);
        expect(dmarc[route.call]).not.toHaveBeenCalled();
      });
      it(`403 for a user holding ${route.action} without access`, async () => {
        h.cpg.grantGlobal("dmarc", route.action);
        await call(route.method, route.path, route.body).set("Authorization", auth(USER)).expect(403);
      });
      it(`${route.status} for a user granted access and ${route.action}`, async () => {
        h.cpg.grantGlobal("dmarc", "access", route.action);
        await call(route.method, route.path, route.body).set("Authorization", auth(USER)).expect(route.status);
        expect(dmarc[route.call]).toHaveBeenCalled();
      });
      it(`${route.status} for root`, async () => {
        await call(route.method, route.path, route.body).set("Authorization", auth(ROOT)).expect(route.status);
      });
    });
  }

  describe("behavior", () => {
    it("passes the parsed filters to the lists", async () => {
      await api()
        .get(`${base}/outgoing?limit=10&offset=20&status=failed&domain=Partner.Example&sortBy=status&sortDir=asc`)
        .set("Authorization", auth(ROOT))
        .expect(200);
      expect(dmarc.listOutgoing).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
          status: "failed",
          domain: "partner.example",
          sortBy: "status",
          sortDir: "asc",
        })
      );
      await api().get(`${base}/incoming?domain=example.org`).set("Authorization", auth(ROOT)).expect(200);
      expect(dmarc.listIncoming).toHaveBeenCalledWith(expect.objectContaining({ domain: "example.org", offset: 0 }));
      await api().get(`${base}/inbox?status=not-a-report&domain=Example.ORG`).set("Authorization", auth(ROOT)).expect(200);
      expect(dmarc.listInbox).toHaveBeenCalledWith(expect.objectContaining({ status: "not-a-report", domain: "example.org" }));
    });

    it("passes the id as a number", async () => {
      await api().get(`${base}/incoming/7`).set("Authorization", auth(ROOT)).expect(200);
      expect(dmarc.incomingReport).toHaveBeenCalledWith(7);
    });

    it("sends the day asked for, and journals what was sent", async () => {
      await api().post(`${base}/outgoing/run`).set("Authorization", auth(ROOT)).send({ day: "2026-09-19" }).expect(200);
      expect(dmarc.runReports).toHaveBeenCalledWith("2026-09-19");
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "dmarc.reports-sent", details: expect.objectContaining({ sent: 1 }) })
      );
    });

    it("journals a retry with the recipient and the outcome", async () => {
      await api().post(`${base}/outgoing/3/retry`).set("Authorization", auth(ROOT)).expect(200);
      expect(activity.record).toHaveBeenCalledWith({
        action: "dmarc.report-retried",
        entity: { type: "dmarc-report", id: 3, label: "dmarc@partner.example" },
        details: { status: "sent", reportId: "partner.example:1" },
      });
    });

    it("journals a scan and a change of settings", async () => {
      await api().post(`${base}/inbox/scan`).set("Authorization", auth(ROOT)).expect(200);
      expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "dmarc.inbox-scanned" }));
      await api().put(`${base}/settings`).set("Authorization", auth(ROOT)).send(SETTINGS).expect(200);
      expect(dmarc.updateSettings).toHaveBeenCalledWith(SETTINGS);
      expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "dmarc.settings-updated" }));
    });
  });

  describe("validation (400)", () => {
    it("400 on an id that is not a number", async () => {
      await api().get(`${base}/incoming/abc`).set("Authorization", auth(ROOT)).expect(400);
      await api().post(`${base}/outgoing/abc/retry`).set("Authorization", auth(ROOT)).expect(400);
    });

    it("400 on a page size or a status it does not know", async () => {
      await api().get(`${base}/incoming?limit=7`).set("Authorization", auth(ROOT)).expect(400);
      await api().get(`${base}/outgoing?status=lost`).set("Authorization", auth(ROOT)).expect(400);
      await api().get(`${base}/inbox?status=lost`).set("Authorization", auth(ROOT)).expect(400);
      expect(dmarc.listOutgoing).not.toHaveBeenCalled();
    });

    it("400 on a day that is not a date, or an extra field", async () => {
      await api().post(`${base}/outgoing/run`).set("Authorization", auth(ROOT)).send({ day: "yesterday" }).expect(400);
      await api()
        .post(`${base}/outgoing/run`)
        .set("Authorization", auth(ROOT))
        .send({ day: "2026-09-19", force: true })
        .expect(400);
      expect(dmarc.runReports).not.toHaveBeenCalled();
    });

    it("400 on settings out of range, badly shaped, incomplete or carrying an unknown field", async () => {
      for (const body of [
        { ...SETTINGS, reportHour: 24 },
        { ...SETTINGS, inboxes: ["not-an-address"] },
        { ...SETTINGS, inboxes: Array.from({ length: 11 }, (_, i) => `u${i}@example.org`) },
        { ...SETTINGS, retentionDays: 3 },
        { ...SETTINGS, orgName: "example.org" },
        { sendingEnabled: true },
        { ...SETTINGS, extra: 1 },
      ]) {
        await api().put(`${base}/settings`).set("Authorization", auth(ROOT)).send(body).expect(400);
      }
      expect(dmarc.updateSettings).not.toHaveBeenCalled();
    });
  });
});
