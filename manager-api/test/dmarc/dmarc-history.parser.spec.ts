import { describe, it, expect } from "vitest";
import { alignment, authResult, disposition, modeOf, parseHistory, policyOf } from "../../src/core/dmarc/dmarc-history.parser";

const RECORD = [
  "job 4X1ABC",
  "reporter mail.example.org",
  "received 1789900000",
  "ipaddr 203.0.113.5",
  "from Partner.Example",
  "mfrom bounce.partner.example",
  "spf 0",
  "dkim partner.example sel1 0",
  "dkim partner.example sel2 7",
  "pdomain partner.example",
  "policy 16",
  "rua mailto:dmarc@partner.example",
  "rua -",
  "pct 50",
  "adkim 115",
  "aspf 114",
  "p 113",
  "sp 114",
  "align_dkim 4",
  "align_spf 5",
  "action 4",
].join("\n");

describe("parseHistory", () => {
  it("reads one record with every field the milter writes", () => {
    const [evaluation] = parseHistory(RECORD);
    expect(evaluation).toEqual({
      jobId: "4X1ABC",
      reporter: "mail.example.org",
      receivedAt: 1789900000000,
      sourceIp: "203.0.113.5",
      headerFrom: "partner.example",
      envelopeFrom: "bounce.partner.example",
      policyDomain: "partner.example",
      spfResult: "pass",
      dkim: [
        { domain: "partner.example", selector: "sel1", result: "pass" },
        { domain: "partner.example", selector: "sel2", result: "fail" },
      ],
      dkimAligned: "pass",
      spfAligned: "fail",
      disposition: "quarantine",
      policy: "quarantine",
      subdomainPolicy: "reject",
      adkim: "s",
      aspf: "r",
      pct: 50,
      rua: ["mailto:dmarc@partner.example"],
    });
  });

  it("splits records on every job line, keeping their signatures apart", () => {
    const text = `${RECORD}\njob 4X1DEF\nreceived 1789900100\nipaddr 198.51.100.7\nfrom other.example\n`;
    const evaluations = parseHistory(text);
    expect(evaluations.map((e) => e.jobId)).toEqual(["4X1ABC", "4X1DEF"]);
    expect(evaluations[1]?.dkim).toEqual([]);
    expect(evaluations[1]?.rua).toEqual([]);
  });

  it("falls back to the header domain, relaxed modes and a full percentage when the policy said nothing", () => {
    const [evaluation] = parseHistory("job 1\nreceived 1789900000\nipaddr 192.0.2.1\nfrom plain.example\n");
    expect(evaluation).toMatchObject({
      policyDomain: "plain.example",
      envelopeFrom: null,
      adkim: "r",
      aspf: "r",
      pct: 100,
      policy: null,
      subdomainPolicy: null,
      spfResult: "unknown",
      disposition: "none",
    });
  });

  it("drops a record missing its address, its domain, its id or its date", () => {
    const text = [
      "job 1\nreceived 1\nfrom a.example",
      "job 2\nipaddr 192.0.2.1\nfrom b.example",
      "job 3\nreceived x\nipaddr 192.0.2.1\nfrom c.example",
      "job 4\nreceived 1\nipaddr 192.0.2.1",
    ].join("\n");
    expect(parseHistory(text)).toEqual([]);
  });

  it("ignores lines before the first job, lines starting with a space and carriage returns", () => {
    const text = "ipaddr 10.0.0.1\r\njob 9\r\n  continued\r\nreceived 1789900000\r\nipaddr 192.0.2.9\r\nfrom crlf.example\r\n";
    const [evaluation] = parseHistory(text);
    expect(evaluation?.sourceIp).toBe("192.0.2.9");
    expect(evaluation?.headerFrom).toBe("crlf.example");
  });

  it("reads nothing out of an empty file", () => {
    expect(parseHistory("")).toEqual([]);
  });
});

describe("the milter's codes", () => {
  it("maps the authentication results the reference reporter maps", () => {
    expect(["0", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12"].map(authResult)).toEqual([
      "pass",
      "softfail",
      "neutral",
      "temperror",
      "permerror",
      "none",
      "fail",
      "policy",
      "nxdomain",
      "signed",
      "discard",
    ]);
    expect(authResult("1")).toBe("unknown");
    expect(authResult(undefined)).toBe("unknown");
  });

  it("maps alignment, disposition, policy and alignment mode", () => {
    expect([alignment("4"), alignment("5"), alignment(undefined)]).toEqual(["pass", "fail", "fail"]);
    expect([disposition("0"), disposition("1"), disposition("2"), disposition("3"), disposition("4")]).toEqual([
      "reject",
      "reject",
      "none",
      "none",
      "quarantine",
    ]);
    expect([policyOf("110"), policyOf("113"), policyOf("114"), policyOf("0"), policyOf(undefined)]).toEqual([
      "none",
      "quarantine",
      "reject",
      null,
      null,
    ]);
    expect([modeOf("114"), modeOf("115"), modeOf(undefined)]).toEqual(["r", "s", "r"]);
  });
});
