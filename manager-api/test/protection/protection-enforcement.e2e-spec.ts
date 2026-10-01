import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Type } from "@nestjs/common";
import { AccountsController } from "../../src/api/accounts/crud/crud.controller";
import { AccountsService } from "../../src/api/accounts/crud/crud.service";
import { AdminDomainsController } from "../../src/api/domains/admin-domains/admin-domains.controller";
import { AliasesController } from "../../src/api/domains/aliases/aliases.controller";
import { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import { DkimController } from "../../src/api/domains/dkim/dkim.controller";
import { DomainsController } from "../../src/api/domains/domains.controller";
import { DomainsService } from "../../src/api/domains/domains.service";
import { RecipientsController } from "../../src/api/domains/recipients/recipients.controller";
import { RecipientsService } from "../../src/api/domains/recipients/recipients.service";
import { MySpaceController } from "../../src/api/my-space/my-space.controller";
import { MySpaceService } from "../../src/api/my-space/my-space.service";
import { DkimService } from "../../src/core/dkim/dkim.service";
import { buildHarness, ROOT, type Harness } from "../helpers/e2e";

const ACCOUNT = "3f1c2b8e-0000-4a00-9000-000000000001";
const OWNER = "3f1c2b8e-0000-4a00-9000-000000000002";

const ok = () => vi.fn(async () => ({}));
const recipients = {
  resolveDomain: vi.fn(async () => "d1.test"),
  update: ok(),
  remove: ok(),
  assignOwner: ok(),
  clearOwner: ok(),
};
const aliases = { resolveDomain: vi.fn(async () => "d1.test"), update: ok(), remove: ok(), assignOwner: ok(), clearOwner: ok() };
const accounts = {
  updateAccount: ok(),
  deleteAccount: ok(),
  resetTwoFactor: ok(),
  resetSecurityQuestion: ok(),
  attachRecipient: ok(),
  detachRecipient: ok(),
  attachAlias: ok(),
  detachAlias: ok(),
};
const domains = { update: ok(), transferOwner: ok(), remove: ok() };
const dkim = { create: ok(), remove: ok(), removeAll: vi.fn(async () => undefined) };
const mySpace = { updateRecipient: ok(), deleteRecipient: ok(), updateAlias: ok(), deleteAlias: ok() };

type Api = ReturnType<typeof request>;

interface Case {
  name: string;
  lock: [string, string | number];
  send: (api: Api) => request.Test;
  called: ReturnType<typeof vi.fn>;
}

const CASES: Case[] = [
  {
    name: "PATCH recipient",
    lock: ["recipient", 7],
    send: (a) => a.patch("/api/v1/domains/1/recipients/7").send({ active: false }),
    called: recipients.update,
  },
  {
    name: "DELETE recipient",
    lock: ["recipient", 7],
    send: (a) => a.delete("/api/v1/domains/1/recipients/7"),
    called: recipients.remove,
  },
  {
    name: "PUT recipient owner",
    lock: ["recipient", 7],
    send: (a) => a.put("/api/v1/domains/1/recipients/7/owner").send({ ownerId: OWNER }),
    called: recipients.assignOwner,
  },
  {
    name: "DELETE recipient owner",
    lock: ["recipient", 7],
    send: (a) => a.delete("/api/v1/domains/1/recipients/7/owner"),
    called: recipients.clearOwner,
  },
  {
    name: "PATCH alias",
    lock: ["alias", 7],
    send: (a) => a.patch("/api/v1/domains/1/aliases/7").send({ destination: "x@example.com" }),
    called: aliases.update,
  },
  { name: "DELETE alias", lock: ["alias", 7], send: (a) => a.delete("/api/v1/domains/1/aliases/7"), called: aliases.remove },
  {
    name: "PUT alias owner",
    lock: ["alias", 7],
    send: (a) => a.put("/api/v1/domains/1/aliases/7/owner").send({ ownerId: OWNER }),
    called: aliases.assignOwner,
  },
  {
    name: "DELETE alias owner",
    lock: ["alias", 7],
    send: (a) => a.delete("/api/v1/domains/1/aliases/7/owner"),
    called: aliases.clearOwner,
  },
  {
    name: "PATCH account",
    lock: ["account", ACCOUNT],
    send: (a) => a.patch(`/api/v1/accounts/${ACCOUNT}/edit`).send({ firstName: "X" }),
    called: accounts.updateAccount,
  },
  {
    name: "DELETE account",
    lock: ["account", ACCOUNT],
    send: (a) => a.delete(`/api/v1/accounts/${ACCOUNT}`),
    called: accounts.deleteAccount,
  },
  {
    name: "reset two-factor",
    lock: ["account", ACCOUNT],
    send: (a) => a.delete(`/api/v1/accounts/${ACCOUNT}/two-factor`),
    called: accounts.resetTwoFactor,
  },
  {
    name: "reset security question",
    lock: ["account", ACCOUNT],
    send: (a) => a.delete(`/api/v1/accounts/${ACCOUNT}/security-question`),
    called: accounts.resetSecurityQuestion,
  },
  {
    name: "attach a protected recipient to an account",
    lock: ["recipient", 7],
    send: (a) => a.post(`/api/v1/accounts/${ACCOUNT}/recipients/7`),
    called: accounts.attachRecipient,
  },
  {
    name: "detach a protected recipient from an account",
    lock: ["recipient", 7],
    send: (a) => a.delete(`/api/v1/accounts/${ACCOUNT}/recipients/7`),
    called: accounts.detachRecipient,
  },
  {
    name: "attach a protected alias to an account",
    lock: ["alias", 7],
    send: (a) => a.post(`/api/v1/accounts/${ACCOUNT}/aliases/7`),
    called: accounts.attachAlias,
  },
  {
    name: "detach a protected alias from an account",
    lock: ["alias", 7],
    send: (a) => a.delete(`/api/v1/accounts/${ACCOUNT}/aliases/7`),
    called: accounts.detachAlias,
  },
  {
    name: "PATCH domain active",
    lock: ["domain", 1],
    send: (a) => a.patch("/api/v1/domains/1/active").send({ active: false }),
    called: domains.update,
  },
  {
    name: "PATCH domain validity",
    lock: ["domain", 1],
    send: (a) => a.patch("/api/v1/domains/1/validity").send({ userStartDate: null, userEndDate: null }),
    called: domains.update,
  },
  {
    name: "PATCH domain owner",
    lock: ["domain", 1],
    send: (a) => a.patch("/api/v1/domains/1/owner").send({ newOwnerId: OWNER }),
    called: domains.transferOwner,
  },
  {
    name: "PATCH domain quota",
    lock: ["domain", 1],
    send: (a) => a.patch("/api/v1/admin/domains/1/quota").send({ quota: 1073741824 }),
    called: domains.update,
  },
  { name: "DELETE domain", lock: ["domain", 1], send: (a) => a.delete("/api/v1/admin/domains/1"), called: domains.remove },
  { name: "rotate DKIM", lock: ["domain", 1], send: (a) => a.post("/api/v1/domains/1/dkim/rotate"), called: dkim.create },
  { name: "DELETE DKIM key", lock: ["domain", 1], send: (a) => a.delete("/api/v1/domains/1/dkim/sel2026"), called: dkim.remove },
  {
    name: "my-space PATCH recipient",
    lock: ["recipient", 7],
    send: (a) => a.patch("/api/v1/my-space/recipients/7").send({ active: false }),
    called: mySpace.updateRecipient,
  },
  {
    name: "my-space DELETE recipient",
    lock: ["recipient", 7],
    send: (a) => a.delete("/api/v1/my-space/recipients/7"),
    called: mySpace.deleteRecipient,
  },
  {
    name: "my-space PATCH alias",
    lock: ["alias", 7],
    send: (a) => a.patch("/api/v1/my-space/aliases/7").send({ destination: "x@example.com" }),
    called: mySpace.updateAlias,
  },
  {
    name: "my-space DELETE alias",
    lock: ["alias", 7],
    send: (a) => a.delete("/api/v1/my-space/aliases/7"),
    called: mySpace.deleteAlias,
  },
];

describe("protection enforcement (e2e: every guarded route refuses a protected resource, root included)", () => {
  let h: Harness;

  beforeAll(async () => {
    const controllers: Type[] = [
      RecipientsController,
      AliasesController,
      AccountsController,
      DomainsController,
      AdminDomainsController,
      DkimController,
      MySpaceController,
    ];
    h = await buildHarness({
      controllers,
      providers: [
        { provide: RecipientsService, useValue: recipients },
        { provide: AliasesService, useValue: aliases },
        { provide: AccountsService, useValue: accounts },
        { provide: DomainsService, useValue: domains },
        { provide: DkimService, useValue: dkim },
        { provide: MySpaceService, useValue: mySpace },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    h.protection.reset();
    for (const group of [recipients, aliases, accounts, domains, dkim, mySpace]) {
      for (const fn of Object.values(group)) fn.mockClear();
    }
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;

  for (const c of CASES) {
    it(`403 protection.locked on ${c.name}, the service untouched`, async () => {
      h.protection.lock(...c.lock);
      const res = await c.send(api()).set("Authorization", root()).expect(403);
      expect(res.body.code).toBe("protection.locked");
      expect(c.called).not.toHaveBeenCalled();
    });

    it(`goes through on ${c.name} once unprotected`, async () => {
      const res = await c.send(api()).set("Authorization", root());
      expect(res.status).toBeLessThan(300);
      expect(c.called).toHaveBeenCalled();
    });
  }
});
