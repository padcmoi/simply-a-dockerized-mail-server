import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DeliverabilityReport } from "~/composables/useDeliverability";
import { downloadReport, reportAsJson, reportAsText, reportFilename } from "~/utils/deliverabilityExport";

const report: DeliverabilityReport = {
  domain: "example.org",
  checkedAt: "2026-08-28T21:15:04.000Z",
  mxHost: "mail.example.org",
  mailIp: "203.0.113.10",
  counts: { pass: 2, warn: 1, fail: 1, skip: 0 },
  checks: [
    { id: "ptr-fcrdns", section: "identity", status: "pass", evidence: "mail.example.org -> 203.0.113.10" },
    { id: "spf-qualifier", section: "dns", status: "warn", evidence: "~all" },
    { id: "dkim-published", section: "dns", status: "fail", evidence: "dkim202601._domainkey.example.org" },
    { id: "starttls", section: "server", status: "pass", evidence: "STARTTLS" },
  ],
};

const labels = {
  title: "Deliverability",
  checkedAt: "Checked at 28/08/2026",
  sections: { identity: "Network identity", dns: "Authentication DNS", server: "The server itself", reputation: "Reputation" },
  status: { pass: "Pass", warn: "Warning", fail: "Failed", skip: "Unknown" },
  label: (id: string) => `label:${id}`,
  hint: (id: string) => (id === "dkim-published" || id === "spf-qualifier" || id === "ptr-fcrdns" ? `hint:${id}` : null),
};

describe("deliverability export", () => {
  it("ends its lines with CRLF, so the report is not one long line in a Windows editor", () => {
    expect(reportAsText(report, labels)).toContain("\r\n");
  });

  it("keeps every field in the JSON shape, for a script or a diff between runs", () => {
    expect(JSON.parse(reportAsJson(report))).toEqual(report);
  });

  it("writes a readable report with the domain, the address and the tally", () => {
    const text = reportAsText(report, labels);
    expect(text).toContain("Deliverability - example.org");
    expect(text).toContain("MX: mail.example.org (203.0.113.10)");
    expect(text).toContain("Pass: 2");
    expect(text).toContain("Failed: 1");
  });

  it("groups the checks under their section, evidence included", () => {
    const text = reportAsText(report, labels);
    expect(text).toContain("## Network identity");
    expect(text).toContain("[PASS] label:ptr-fcrdns");
    expect(text).toContain("mail.example.org -> 203.0.113.10");
    expect(text.indexOf("## Network identity")).toBeLessThan(text.indexOf("## Authentication DNS"));
  });

  // The fix rides along only where it is due: advice under a green check is
  // noise, and noise is what makes a report go unread.
  it("carries the fix under failing and warning checks, never under a passing one", () => {
    const text = reportAsText(report, labels);
    expect(text).toContain("-> hint:dkim-published");
    expect(text).toContain("-> hint:spf-qualifier");
    expect(text).not.toContain("hint:ptr-fcrdns");
  });

  it("skips a section that holds no check rather than printing an empty heading", () => {
    expect(reportAsText(report, labels)).not.toContain("## Reputation");
  });

  // The bytes were always UTF-8 (a Blob encodes nothing else); what was missing
  // was the marker, without which an editor on a legacy codepage renders
  // "delivrabilite" with mojibake in place of every accent.
  describe("encoding", () => {
    const saved: { body: string; type: string }[] = [];

    beforeEach(() => {
      saved.length = 0;
      // A capturing double for Blob: what the file will hold is exactly what is
      // handed to it, so recording the parts is recording the file.
      function FakeBlob(parts: string[], options: { type: string }) {
        saved.push({ body: parts.join(""), type: options.type });
      }
      vi.stubGlobal("Blob", FakeBlob);
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
      const anchor = document.createElement("a");
      anchor.click = () => undefined;
      vi.spyOn(document, "createElement").mockReturnValue(anchor);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("marks the text report as UTF-8 with a BOM", () => {
      downloadReport("délivrabilité", "r.txt", "text/plain");
      expect(saved[0]!.body.startsWith("\ufeff")).toBe(true);
      expect(saved[0]!.type).toBe("text/plain;charset=utf-8");
    });

    it("leaves the JSON byte-clean, a BOM being something a parser may reject", () => {
      downloadReport('{"a":"é"}', "r.json", "application/json");
      expect(saved[0]!.body.startsWith("\ufeff")).toBe(false);
      expect(JSON.parse(saved[0]!.body)).toEqual({ a: "é" });
    });
  });

  it("names the file after the domain and the run, with no character a filesystem trips over", () => {
    const name = reportFilename("example.org", report.checkedAt, "txt");
    expect(name).toBe("deliverability-example.org-2026-08-28-21-15-04.txt");
    expect(name).not.toMatch(/[:T]/);
  });
});
