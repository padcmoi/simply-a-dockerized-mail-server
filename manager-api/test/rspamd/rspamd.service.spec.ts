import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { RspamdService, RSPAMD_FACTORY_ACTIONS, type RspamdHistoryRow } from "../../src/core/rspamd/rspamd.service";
import { readDomainBayes } from "../../src/core/rspamd/bayes-redis";

// domainBayes is best-effort over Redis; stub the whole module so the service
// spec never touches a socket. bayes-redis.spec.ts covers the real reader.
vi.mock("../../src/core/rspamd/bayes-redis", () => ({ readDomainBayes: vi.fn() }));

// Minimal fetch Response doubles: the service only reads `.ok`, `.status` and
// `.json()`. They stay re-readable (json replays the same payload on every call)
// so one mockResolvedValue still serves the tests that fetch more than once.
const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const notOk = (status: number) => ({ ok: false, status, json: async () => ({}) });

// Reads back the HttpException a rejected service call threw, so its status can
// be asserted without leaning on any non-public field.
async function catchHttp(p: Promise<unknown>): Promise<HttpException> {
  try {
    await p;
  } catch (e) {
    return e as HttpException;
  }
  throw new Error("expected the call to throw an HttpException");
}

// A generous set of history rows exercising every sort column and the domain
// filter. Only the fields the service reads are populated.
function rows(): RspamdHistoryRow[] {
  const base = {
    "message-id": "",
    ip: "",
    required_score: 0,
    time_real: 0,
    sender_mime: "",
    rcpt_mime: [],
    user: "",
  };
  return [
    { ...base, sender_smtp: "bob@x.com", rcpt_smtp: ["carol@example.com"], action: "reject", score: 9, size: 300, unix_time: 30, subject: "hello" },
    { ...base, sender_smtp: "amy@x.com", rcpt_smtp: ["dave@example.com"], action: "no action", score: 1, size: 100, unix_time: 10, subject: "world" },
    { ...base, sender_smtp: "cid@x.com", rcpt_smtp: ["ed@other.com"], action: "greylist", score: 5, size: 200, unix_time: 20, subject: "meeting" },
  ] as RspamdHistoryRow[];
}

describe("RspamdService", () => {
  let svc: RspamdService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = new RspamdService();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  describe("stats", () => {
    it("returns the parsed body on success", async () => {
      fetchMock.mockResolvedValue(okJson({ version: "3.8", scanned: 12 }));
      await expect(svc.stats()).resolves.toEqual({ version: "3.8", scanned: 12 });
      expect(fetchMock).toHaveBeenCalledWith("http://mail-rspamd:11334/stat");
    });
    it("throws 503 when rspamd is unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
      expect((await catchHttp(svc.stats())).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
    it("throws 502 on a non-2xx response", async () => {
      fetchMock.mockResolvedValue(notOk(500));
      expect((await catchHttp(svc.stats())).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  describe("getActions", () => {
    it("maps every rspamd action name to the thresholds shape", async () => {
      fetchMock.mockResolvedValue(
        okJson([
          { action: "reject", value: 15 },
          { action: "soft reject", value: 12 },
          { action: "rewrite subject", value: 8 },
          { action: "add header", value: 5 },
          { action: "greylist", value: 3 },
        ])
      );
      await expect(svc.getActions()).resolves.toEqual({
        reject: 15,
        softReject: 12,
        rewriteSubject: 8,
        addHeader: 5,
        greylist: 3,
      });
    });
    it("falls back to null for any action rspamd omits", async () => {
      fetchMock.mockResolvedValue(okJson([]));
      await expect(svc.getActions()).resolves.toEqual({
        reject: null,
        softReject: null,
        rewriteSubject: null,
        addHeader: null,
        greylist: null,
      });
    });
    it("throws 503 when unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("down"));
      expect((await catchHttp(svc.getActions())).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
    it("throws 502 on a non-2xx response", async () => {
      fetchMock.mockResolvedValue(notOk(503));
      expect((await catchHttp(svc.getActions())).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  describe("saveActions", () => {
    const input = { reject: 15, rewriteSubject: null, addHeader: 5, greylist: null };
    it("POSTs the ordered payload and resolves on success", async () => {
      fetchMock.mockResolvedValue(okJson({ success: true }));
      await expect(svc.saveActions(input)).resolves.toBeUndefined();
      const [callUrl, init] = fetchMock.mock.calls[0];
      expect(callUrl).toBe("http://mail-rspamd:11334/saveactions");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual([15, null, 5, null]);
    });
    it("throws 503 when unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("down"));
      expect((await catchHttp(svc.saveActions(input))).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
    it("throws 502 on a non-2xx response", async () => {
      fetchMock.mockResolvedValue(notOk(500));
      expect((await catchHttp(svc.saveActions(input))).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
    it("throws 502 with rspamd's error message when success is false", async () => {
      fetchMock.mockResolvedValue(okJson({ success: false, error: "bad thresholds" }));
      const e = await catchHttp(svc.saveActions(input));
      expect(e.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(e.message).toBe("bad thresholds");
    });
    it("throws 502 with a default message when success is false and no error", async () => {
      fetchMock.mockResolvedValue(okJson({ success: false }));
      const e = await catchHttp(svc.saveActions(input));
      expect(e.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(e.message).toBe("Rspamd rejected the new thresholds");
    });
  });

  describe("resetActions", () => {
    it("re-saves the shipped factory baseline", async () => {
      fetchMock.mockResolvedValue(okJson({ success: true }));
      await svc.resetActions();
      const init = fetchMock.mock.calls[0][1];
      expect(JSON.parse(init.body)).toEqual([
        RSPAMD_FACTORY_ACTIONS.reject,
        RSPAMD_FACTORY_ACTIONS.rewriteSubject,
        RSPAMD_FACTORY_ACTIONS.addHeader,
        RSPAMD_FACTORY_ACTIONS.greylist,
      ]);
    });
  });

  describe("history", () => {
    it("throws 503 when unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("down"));
      expect((await catchHttp(svc.history(undefined))).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
    it("throws 502 on a non-2xx response", async () => {
      fetchMock.mockResolvedValue(notOk(500));
      expect((await catchHttp(svc.history(undefined))).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
    it("returns the full array (default size 200) when no query is given", async () => {
      fetchMock.mockResolvedValue(okJson({ rows: rows() }));
      const res = await svc.history(undefined);
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledWith("http://mail-rspamd:11334/history?size=200");
    });
    it("defaults rows to an empty array when rspamd omits them", async () => {
      fetchMock.mockResolvedValue(okJson({}));
      await expect(svc.history(undefined)).resolves.toEqual([]);
    });
    it("requests the explicit size and filters to the domain's recipients", async () => {
      fetchMock.mockResolvedValue(okJson({ rows: rows() }));
      // The 2-arg overload returns the plain array (no pagination), so no narrowing needed.
      const res = await svc.history("example.com", 50);
      expect(fetchMock).toHaveBeenCalledWith("http://mail-rspamd:11334/history?size=50");
      expect(res).toHaveLength(2);
      expect(res.every((r) => r.rcpt_smtp[0].endsWith("@example.com"))).toBe(true);
    });
    it("also matches a domain as the sender, not only the recipient", async () => {
      fetchMock.mockResolvedValue(
        okJson({
          rows: [
            { ...rows()[0], sender_smtp: "post@sending.com", rcpt_smtp: ["someone@other.com"] },
            { ...rows()[0], sender_smtp: "other@x.com", rcpt_smtp: ["mailbox@sending.com"] },
            { ...rows()[0], sender_smtp: "nobody@x.com", rcpt_smtp: ["nobody@x.com"] },
          ],
        })
      );
      const res = await svc.history("sending.com", 50);
      expect(res).toHaveLength(2);
      expect(res.every((r) => r.sender_smtp.endsWith("@sending.com") || r.rcpt_smtp.some((x) => x.endsWith("@sending.com")))).toBe(true);
    });
    it("tolerates rows without a rcpt_smtp array while filtering", async () => {
      fetchMock.mockResolvedValue(okJson({ rows: [{ ...rows()[0], rcpt_smtp: undefined }] }));
      const res = await svc.history("example.com", 200);
      expect(res).toEqual([]);
    });
    it("returns the plain array when a query carries no limit", async () => {
      fetchMock.mockResolvedValue(okJson({ rows: rows() }));
      const res = await svc.history(undefined, 200, { offset: 0, sortDir: "desc" });
      expect(Array.isArray(res)).toBe(true);
    });

    describe("paginated", () => {
      beforeEach(() => fetchMock.mockResolvedValue(okJson({ rows: rows() })));
      // Every call here carries a limit, so history returns the paginated shape;
      // a runtime guard narrows the union instead of a cast.
      const paginate = async (q: Record<string, unknown>) => {
        const res = await svc.history(undefined, 200, { offset: 0, sortDir: "desc", ...q });
        if (Array.isArray(res)) throw new Error("expected a paginated result");
        return res;
      };

      it("wraps the window in { items, total }", async () => {
        const res = await paginate({ limit: 10 });
        expect(res.total).toBe(3);
        expect(res.items).toHaveLength(3);
      });
      it("searches across sender, recipient and subject", async () => {
        expect((await paginate({ limit: 10, search: "amy" })).items).toHaveLength(1); // sender
        expect((await paginate({ limit: 10, search: "carol" })).items).toHaveLength(1); // recipient
        expect((await paginate({ limit: 10, search: "meeting" })).items).toHaveLength(1); // subject
        expect((await paginate({ limit: 10, search: "zzz" })).items).toHaveLength(0);
      });
      it("sorts by sender_smtp ascending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "sender_smtp", sortDir: "asc" });
        expect(items.map((r) => r.sender_smtp)).toEqual(["amy@x.com", "bob@x.com", "cid@x.com"]);
      });
      it("sorts by rcpt (first recipient) descending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "rcpt", sortDir: "desc" });
        expect(items.map((r) => r.rcpt_smtp[0])).toEqual(["ed@other.com", "dave@example.com", "carol@example.com"]);
      });
      it("sorts by action ascending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "action", sortDir: "asc" });
        expect(items.map((r) => r.action)).toEqual(["greylist", "no action", "reject"]);
      });
      it("sorts by score ascending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "score", sortDir: "asc" });
        expect(items.map((r) => r.score)).toEqual([1, 5, 9]);
      });
      it("sorts by size descending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "size", sortDir: "desc" });
        expect(items.map((r) => r.size)).toEqual([300, 200, 100]);
      });
      it("sorts by time ascending", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "time", sortDir: "asc" });
        expect(items.map((r) => r.unix_time)).toEqual([10, 20, 30]);
      });
      it("falls back to the default time column on an unknown sortBy", async () => {
        const { items } = await paginate({ limit: 10, sortBy: "bogus", sortDir: "desc" });
        expect(items.map((r) => r.unix_time)).toEqual([30, 20, 10]);
      });
      it("keeps equal sort values as ties (comparator returns 0)", async () => {
        fetchMock.mockResolvedValue(okJson({ rows: [rows()[0], { ...rows()[1], score: rows()[0].score }] }));
        const res = await paginate({ limit: 10, sortBy: "score", sortDir: "asc" });
        expect(res.total).toBe(2);
      });
      it("applies the offset window", async () => {
        const res = await paginate({ limit: 1, offset: 1, sortBy: "time", sortDir: "asc" });
        expect(res.total).toBe(3);
        expect(res.items.map((r) => r.unix_time)).toEqual([20]);
      });
      it("tolerates missing sortable fields (nullish fallbacks in every string column)", async () => {
        // Two rows so the sort comparator actually fires, and each carries no
        // sender/rcpt/action, exercising the `?? ""` fallback for those columns.
        const bare = { ...rows()[0], sender_smtp: undefined, action: undefined, rcpt_smtp: undefined };
        fetchMock.mockResolvedValue(okJson({ rows: [bare, { ...bare }] }));
        for (const sortBy of ["sender_smtp", "rcpt", "action"]) {
          const { items } = await paginate({ limit: 10, sortBy, sortDir: "asc" });
          expect(items).toHaveLength(2);
        }
      });
    });
  });

  describe("domainBayes (best-effort)", () => {
    it("returns the Redis reader's result", async () => {
      const payload = { recipients: [{ recipient: "a@x.com", learnsHam: 2, learnsSpam: 1 }], totalHam: 2, totalSpam: 1 };
      vi.mocked(readDomainBayes).mockResolvedValue(payload);
      await expect(svc.domainBayes("x.com")).resolves.toEqual(payload);
      expect(readDomainBayes).toHaveBeenCalledWith("x.com");
    });
    it("degrades to an empty result when Redis fails", async () => {
      vi.mocked(readDomainBayes).mockRejectedValue(new Error("redis down"));
      await expect(svc.domainBayes("x.com")).resolves.toEqual({ recipients: [], totalHam: 0, totalSpam: 0 });
    });
  });
});
