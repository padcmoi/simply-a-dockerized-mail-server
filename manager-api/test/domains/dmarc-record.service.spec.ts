import { describe, it, expect, beforeEach, vi } from "vitest";
import { promises as dns } from "dns";
import {
  DmarcRecordService,
  parseDmarcTags,
  recommendedDmarcRecord,
  reportsTo,
} from "../../src/api/domains/dmarc-record/dmarc-record.service";

describe("the DMARC record helpers", () => {
  it("reads the tags in order, keys lower-cased, a tag without value kept", () => {
    expect(parseDmarcTags("v=DMARC1; P=reject ;rua = mailto:a@x.test, mailto:b@y.test; bare;")).toEqual([
      ["v", "DMARC1"],
      ["p", "reject"],
      ["rua", "mailto:a@x.test, mailto:b@y.test"],
      ["bare", ""],
    ]);
  });

  it("knows whether a record reports to the mailbox, size limit or case aside", () => {
    expect(reportsTo("v=DMARC1; rua=mailto:other@x.test,MAILTO:dmarc_reports@x.test!10m", "dmarc_reports@x.test")).toBe(true);
    expect(reportsTo("v=DMARC1; ruf=mailto:dmarc_reports@x.test", "dmarc_reports@x.test")).toBe(false);
    expect(reportsTo(null, "dmarc_reports@x.test")).toBe(false);
  });

  it("proposes a monitoring policy for a domain that publishes nothing", () => {
    expect(recommendedDmarcRecord("New.Test", null)).toBe(
      "v=DMARC1; p=none; rua=mailto:dmarc_reports@new.test; fo=1; adkim=r; aspf=r"
    );
  });

  it("keeps a published record's policy and tags, putting the mailbox in front of the other rua", () => {
    expect(
      recommendedDmarcRecord("x.test", "v=DMARC1; p=quarantine; sp=reject; pct=50; rua=mailto:other@x.test; ruf=mailto:f@x.test")
    ).toBe("v=DMARC1; p=quarantine; sp=reject; pct=50; rua=mailto:dmarc_reports@x.test,mailto:other@x.test; ruf=mailto:f@x.test");
  });

  it("adds the rua right after the policy when there is none, and leaves a correct record as it is", () => {
    expect(recommendedDmarcRecord("x.test", "v=DMARC1; p=reject; adkim=s")).toBe(
      "v=DMARC1; p=reject; rua=mailto:dmarc_reports@x.test; adkim=s"
    );
    const correct = "v=DMARC1; p=reject; rua=mailto:dmarc_reports@x.test";
    expect(recommendedDmarcRecord("x.test", correct)).toBe(correct);
  });

  it("repairs a published record missing its version or its policy", () => {
    expect(recommendedDmarcRecord("x.test", "rua=mailto:dmarc_reports@x.test")).toBe(
      "v=DMARC1; p=none; rua=mailto:dmarc_reports@x.test"
    );
  });
});

describe("DmarcRecordService", () => {
  const svc = new DmarcRecordService();

  beforeEach(() => vi.restoreAllMocks());

  it("describes the record from what DNS publishes", async () => {
    vi.spyOn(dns, "resolveTxt").mockResolvedValue([
      ["google-site-verification=1"],
      ["v=DMARC1; p=reject; ", "rua=mailto:dmarc_reports@x.test"],
    ]);
    await expect(svc.describe("X.test")).resolves.toEqual({
      dnsName: "_dmarc.x.test",
      txtRecord: "v=DMARC1; p=reject; rua=mailto:dmarc_reports@x.test",
      mailbox: "dmarc_reports@x.test",
      published: "v=DMARC1; p=reject; rua=mailto:dmarc_reports@x.test",
      reportsHere: true,
      error: null,
    });
    expect(dns.resolveTxt).toHaveBeenCalledWith("_dmarc.x.test");
  });

  it("says why nothing was found when the lookup fails", async () => {
    vi.spyOn(dns, "resolveTxt").mockRejectedValue(Object.assign(new Error("queryTxt ENOTFOUND"), { code: "ENOTFOUND" }));
    await expect(svc.describe("x.test")).resolves.toMatchObject({ published: null, reportsHere: false, error: "ENOTFOUND" });
    vi.spyOn(dns, "resolveTxt").mockRejectedValue(new Error("boom"));
    await expect(svc.describe("x.test")).resolves.toMatchObject({ error: "boom" });
  });

  it("finds no record among TXT entries that are not DMARC", async () => {
    vi.spyOn(dns, "resolveTxt").mockResolvedValue([["v=spf1 -all"]]);
    await expect(svc.describe("x.test")).resolves.toMatchObject({ published: null, error: null });
  });
});
