import { describe, it, expect } from "vitest";
import { parseFeedback } from "../../src/core/dmarc/dmarc-feedback.parser";
import { GOOGLE_REPORT } from "./fixtures";

describe("parseFeedback", () => {
  it("reads the metadata and the published policy of a report", () => {
    const feedback = parseFeedback(GOOGLE_REPORT);
    expect(feedback).toMatchObject({
      orgName: "google.com",
      email: "noreply-dmarc-support@google.com",
      extraContact: "https://support.google.com/a/answer/2466580",
      reportId: "12345678901234567890",
      begin: 1789862400,
      end: 1789948799,
      policy: { domain: "example.com", adkim: "r", aspf: "s", p: "quarantine", sp: "reject", pct: 100 },
    });
    expect(feedback.records).toHaveLength(2);
  });

  it("reads each record, its identifiers, its authentication results and its reasons", () => {
    const [first, second] = parseFeedback(GOOGLE_REPORT).records;
    expect(first).toEqual({
      sourceIp: "203.0.113.5",
      count: 17,
      disposition: "none",
      dkim: "pass",
      spf: "pass",
      headerFrom: "example.com",
      envelopeFrom: null,
      envelopeTo: null,
      dkimResults: [{ domain: "example.com", selector: "dkim202602", result: "pass" }],
      spfResults: [{ domain: "example.com", scope: null, result: "pass" }],
      reasons: [],
    });
    expect(second).toMatchObject({
      disposition: "quarantine",
      dkim: "fail",
      spf: "fail",
      envelopeFrom: "bounce.spam.test",
      envelopeTo: "someone@gmail.com",
      dkimResults: [
        { domain: "spam.test", selector: null, result: "fail" },
        { domain: "relay.test", selector: "r1", result: "pass" },
      ],
      spfResults: [{ domain: "bounce.spam.test", scope: "mfrom", result: "softfail" }],
      reasons: [{ type: "forwarded", comment: "looks forwarded" }],
    });
  });

  it("reads a report with a single record and namespaced elements", () => {
    const xml = GOOGLE_REPORT.replace(/<record>[\s\S]*?<\/record>\s*<record>/, "<record>")
      .replace("<feedback>", '<dmarc:feedback xmlns:dmarc="urn:ietf:params:xml:ns:dmarc-2.0">')
      .replace("</feedback>", "</dmarc:feedback>");
    const feedback = parseFeedback(xml);
    expect(feedback.records).toHaveLength(1);
    expect(feedback.records[0]?.count).toBe(2);
  });

  it("assumes a none policy, relaxed modes and a full percentage when the report says nothing", () => {
    const xml =
      "<feedback><report_metadata><org_name>x.org</org_name><report_id>r1</report_id></report_metadata>" +
      "<policy_published><domain>example.com</domain><p>bogus</p></policy_published></feedback>";
    const feedback = parseFeedback(xml);
    expect(feedback.policy).toEqual({ domain: "example.com", adkim: "r", aspf: "r", p: "none", sp: "none", pct: 100 });
    expect(feedback.records).toEqual([]);
    expect(feedback.begin).toBe(0);
    expect(feedback.email).toBe("");
  });

  it("refuses a document that is not an aggregate report", () => {
    expect(() => parseFeedback("<html><body>hi</body></html>")).toThrow("not a DMARC aggregate report");
  });

  it("refuses a report without a domain, an organisation or an id", () => {
    expect(() => parseFeedback("<feedback><report_metadata><org_name>x</org_name></report_metadata></feedback>")).toThrow(
      "names no domain"
    );
  });
});
