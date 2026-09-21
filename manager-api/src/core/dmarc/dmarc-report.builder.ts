import type { DmarcEvaluationInput, DmarcPublishedPolicy } from "./dmarc.types";

const SPF_RESULTS = new Set(["none", "neutral", "pass", "fail", "softfail", "temperror", "permerror"]);
const DKIM_RESULTS = new Set(["none", "pass", "fail", "policy", "neutral", "temperror", "permerror"]);

export interface DmarcReportInput {
  orgName: string;
  email: string;
  reportId: string;
  begin: number;
  end: number;
  policy: DmarcPublishedPolicy;
  evaluations: DmarcEvaluationInput[];
}

export interface BuiltDmarcReport {
  xml: string;
  records: number;
  messages: number;
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function spfResultOf(result: string): string {
  return SPF_RESULTS.has(result) ? result : "none";
}

export function dkimResultOf(result: string): string {
  if (result === "softfail") return "fail";
  return DKIM_RESULTS.has(result) ? result : "none";
}

export function publishedPolicyOf(domain: string, evaluations: DmarcEvaluationInput[]): DmarcPublishedPolicy {
  const latest = [...evaluations].sort((a, b) => b.receivedAt - a.receivedAt)[0];
  const p = latest?.policy ?? "none";
  return {
    domain,
    adkim: latest?.adkim ?? "r",
    aspf: latest?.aspf ?? "r",
    p,
    sp: latest?.subdomainPolicy ?? p,
    pct: latest?.pct ?? 100,
  };
}

interface Row {
  sample: DmarcEvaluationInput;
  dkim: { domain: string; selector: string; result: string }[];
  count: number;
}

function rowKey(evaluation: DmarcEvaluationInput, dkim: Row["dkim"]) {
  return JSON.stringify([
    evaluation.sourceIp,
    evaluation.disposition,
    evaluation.dkimAligned,
    evaluation.spfAligned,
    evaluation.headerFrom,
    evaluation.envelopeFrom ?? evaluation.headerFrom,
    evaluation.recipientDomain ?? null,
    spfResultOf(evaluation.spfResult),
    dkim,
  ]);
}

function uniqueDkim(evaluation: DmarcEvaluationInput): Row["dkim"] {
  const seen = new Map<string, Row["dkim"][number]>();
  for (const signature of evaluation.dkim) {
    const entry = { domain: signature.domain, selector: signature.selector, result: dkimResultOf(signature.result) };
    seen.set(JSON.stringify(entry), entry);
  }
  return [...seen.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function tag(name: string, value: string | number, indent: string) {
  return `${indent}<${name}>${escapeXml(String(value))}</${name}>`;
}

function recordXml(row: Row): string[] {
  const e = row.sample;
  const lines = [
    "  <record>",
    "    <row>",
    tag("source_ip", e.sourceIp, "      "),
    tag("count", row.count, "      "),
    "      <policy_evaluated>",
    tag("disposition", e.disposition, "        "),
    tag("dkim", e.dkimAligned, "        "),
    tag("spf", e.spfAligned, "        "),
    "      </policy_evaluated>",
    "    </row>",
    "    <identifiers>",
    ...(e.recipientDomain ? [tag("envelope_to", e.recipientDomain, "      ")] : []),
    tag("header_from", e.headerFrom, "      "),
    "    </identifiers>",
    "    <auth_results>",
  ];
  for (const signature of row.dkim) {
    lines.push("      <dkim>", tag("domain", signature.domain, "        "));
    if (signature.selector) lines.push(tag("selector", signature.selector, "        "));
    lines.push(tag("result", signature.result, "        "), "      </dkim>");
  }
  lines.push(
    "      <spf>",
    tag("domain", e.envelopeFrom ?? e.headerFrom, "        "),
    tag("scope", "mfrom", "        "),
    tag("result", spfResultOf(e.spfResult), "        "),
    "      </spf>",
    "    </auth_results>",
    "  </record>"
  );
  return lines;
}

export function buildDmarcReport(input: DmarcReportInput): BuiltDmarcReport {
  const rows = new Map<string, Row>();
  for (const evaluation of input.evaluations) {
    const dkim = uniqueDkim(evaluation);
    const key = rowKey(evaluation, dkim);
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { sample: evaluation, dkim, count: 1 });
  }

  const p = input.policy;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<feedback>",
    "  <version>1.0</version>",
    "  <report_metadata>",
    tag("org_name", input.orgName, "    "),
    tag("email", input.email, "    "),
    tag("report_id", input.reportId, "    "),
    "    <date_range>",
    tag("begin", input.begin, "      "),
    tag("end", input.end, "      "),
    "    </date_range>",
    "  </report_metadata>",
    "  <policy_published>",
    tag("domain", p.domain, "    "),
    tag("adkim", p.adkim, "    "),
    tag("aspf", p.aspf, "    "),
    tag("p", p.p, "    "),
    tag("sp", p.sp, "    "),
    tag("pct", p.pct, "    "),
    "  </policy_published>",
    ...[...rows.values()].flatMap(recordXml),
    "</feedback>",
    "",
  ];

  return { xml: lines.join("\n"), records: rows.size, messages: input.evaluations.length };
}
