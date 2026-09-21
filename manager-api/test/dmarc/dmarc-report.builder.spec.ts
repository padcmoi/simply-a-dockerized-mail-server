import { describe, it, expect } from "vitest";
import {
  buildDmarcReport,
  dkimResultOf,
  escapeXml,
  publishedPolicyOf,
  spfResultOf,
} from "../../src/core/dmarc/dmarc-report.builder";
import type { DmarcEvaluationInput } from "../../src/core/dmarc/dmarc.types";

function evaluation(overrides: Partial<DmarcEvaluationInput> = {}): DmarcEvaluationInput {
  return {
    jobId: "1",
    reporter: "mail.example.org",
    receivedAt: 1789900000000,
    sourceIp: "203.0.113.5",
    headerFrom: "partner.example",
    envelopeFrom: "partner.example",
    policyDomain: "partner.example",
    spfResult: "pass",
    dkim: [{ domain: "partner.example", selector: "sel1", result: "pass" }],
    dkimAligned: "pass",
    spfAligned: "pass",
    disposition: "none",
    policy: "none",
    subdomainPolicy: null,
    adkim: "r",
    aspf: "r",
    pct: 100,
    rua: ["mailto:dmarc@partner.example"],
    ...overrides,
  };
}

const base = {
  orgName: "example.org",
  email: "dmarc-reports@example.org",
  reportId: "partner.example:1789862400",
  begin: 1789862400,
  end: 1789948799,
};

describe("buildDmarcReport", () => {
  it("counts identical messages on one row and different ones apart", () => {
    const evaluations = [
      evaluation(),
      evaluation({ jobId: "2" }),
      evaluation({
        jobId: "3",
        sourceIp: "198.51.100.7",
        envelopeFrom: null,
        spfResult: "fail",
        dkim: [],
        dkimAligned: "fail",
        spfAligned: "fail",
        disposition: "quarantine",
      }),
    ];
    const report = buildDmarcReport({ ...base, policy: publishedPolicyOf("partner.example", evaluations), evaluations });

    expect(report.records).toBe(2);
    expect(report.messages).toBe(3);
    expect(report.xml).toContain("<count>2</count>");
    expect(report.xml).toContain("<count>1</count>");
    expect(report.xml).toContain("<disposition>quarantine</disposition>");
    expect(report.xml.match(/<record>/g)).toHaveLength(2);
  });

  it("names the hosted domain the messages were delivered to, and keeps apart two such domains", () => {
    const evaluations = [
      evaluation({ recipientDomain: "example.org" }),
      evaluation({ jobId: "2", recipientDomain: "example.net" }),
    ];
    const report = buildDmarcReport({ ...base, policy: publishedPolicyOf("partner.example", evaluations), evaluations });
    expect(report.records).toBe(2);
    expect(report.xml).toContain("<envelope_to>example.org</envelope_to>\n      <header_from>partner.example</header_from>");
    expect(report.xml).toContain("<envelope_to>example.net</envelope_to>");
    expect(
      buildDmarcReport({ ...base, policy: publishedPolicyOf("partner.example", [evaluation()]), evaluations: [evaluation()] }).xml
    ).not.toContain("envelope_to");
  });

  it("writes the metadata, the date range and the published policy", () => {
    const report = buildDmarcReport({
      ...base,
      policy: { domain: "partner.example", adkim: "s", aspf: "r", p: "reject", sp: "quarantine", pct: 25 },
      evaluations: [evaluation()],
    });
    expect(report.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<feedback>')).toBe(true);
    for (const piece of [
      "<org_name>example.org</org_name>",
      "<email>dmarc-reports@example.org</email>",
      "<report_id>partner.example:1789862400</report_id>",
      "<begin>1789862400</begin>",
      "<end>1789948799</end>",
      "<adkim>s</adkim>",
      "<p>reject</p>",
      "<sp>quarantine</sp>",
      "<pct>25</pct>",
    ]) {
      expect(report.xml).toContain(piece);
    }
  });

  it("names the envelope domain for SPF, the header domain when the envelope was empty", () => {
    const withEnvelope = buildDmarcReport({
      ...base,
      policy: publishedPolicyOf("partner.example", []),
      evaluations: [evaluation({ envelopeFrom: "bounce.example" })],
    });
    expect(withEnvelope.xml).toContain("<domain>bounce.example</domain>\n        <scope>mfrom</scope>");
    const without = buildDmarcReport({
      ...base,
      policy: publishedPolicyOf("partner.example", []),
      evaluations: [evaluation({ envelopeFrom: null })],
    });
    expect(without.xml).toContain("<domain>partner.example</domain>\n        <scope>mfrom</scope>");
  });

  it("writes each signature once, and leaves out an empty selector", () => {
    const report = buildDmarcReport({
      ...base,
      policy: publishedPolicyOf("partner.example", []),
      evaluations: [
        evaluation({
          dkim: [
            { domain: "partner.example", selector: "sel1", result: "pass" },
            { domain: "partner.example", selector: "sel1", result: "pass" },
            { domain: "other.example", selector: "", result: "softfail" },
          ],
        }),
      ],
    });
    expect(report.xml.match(/<dkim>\n/g)).toHaveLength(2);
    expect(report.xml).toContain("<domain>other.example</domain>\n        <result>fail</result>");
  });

  it("escapes what it writes", () => {
    const report = buildDmarcReport({
      ...base,
      orgName: "A & B <co>",
      policy: publishedPolicyOf("partner.example", []),
      evaluations: [],
    });
    expect(report.xml).toContain("<org_name>A &amp; B &lt;co&gt;</org_name>");
    expect(report.records).toBe(0);
  });
});

describe("the helpers", () => {
  it("escapes the five XML characters", () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
  });

  it("keeps the results the schema allows and turns the others into none", () => {
    expect(["pass", "softfail", "nxdomain", "unknown"].map(spfResultOf)).toEqual(["pass", "softfail", "none", "none"]);
    expect(["pass", "policy", "softfail", "signed"].map(dkimResultOf)).toEqual(["pass", "policy", "fail", "none"]);
  });

  it("takes the published policy from the latest message, the subdomain policy defaulting to the policy", () => {
    const older = evaluation({ receivedAt: 1, policy: "reject", aspf: "s" });
    const newer = evaluation({ receivedAt: 2, policy: "quarantine", subdomainPolicy: null, pct: 40 });
    expect(publishedPolicyOf("partner.example", [older, newer])).toEqual({
      domain: "partner.example",
      adkim: "r",
      aspf: "r",
      p: "quarantine",
      sp: "quarantine",
      pct: 40,
    });
  });

  it("assumes a relaxed none policy when nothing was recorded", () => {
    expect(publishedPolicyOf("x.example", [])).toEqual({
      domain: "x.example",
      adkim: "r",
      aspf: "r",
      p: "none",
      sp: "none",
      pct: 100,
    });
  });
});
