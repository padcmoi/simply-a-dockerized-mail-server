import { XMLParser } from "fast-xml-parser";
import type { DmarcAlignmentMode, DmarcFeedback, DmarcPolicy, DmarcReportRecord, DmarcVerdict } from "./dmarc.types";

const ARRAYS = new Set([
  "feedback.record",
  "feedback.record.auth_results.dkim",
  "feedback.record.auth_results.spf",
  "feedback.record.row.policy_evaluated.reason",
]);

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  removeNSPrefix: true,
  isArray: (_name, jpath) => ARRAYS.has(String(jpath)),
});

type Node = Record<string, unknown>;

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return text((value as Node)["#text"]);
  return String(value).trim();
}

function optional(value: unknown): string | null {
  const t = text(value);
  return t ? t : null;
}

function node(value: unknown): Node {
  return value && typeof value === "object" ? (value as Node) : {};
}

function list(value: unknown): Node[] {
  if (Array.isArray(value)) return value.map(node);
  return value === undefined ? [] : [node(value)];
}

function policyOf(value: unknown, fallback: DmarcPolicy): DmarcPolicy {
  const t = text(value).toLowerCase();
  return t === "none" || t === "quarantine" || t === "reject" ? t : fallback;
}

function modeOf(value: unknown): DmarcAlignmentMode {
  return text(value).toLowerCase() === "s" ? "s" : "r";
}

function verdictOf(value: unknown): DmarcVerdict {
  return text(value).toLowerCase() === "pass" ? "pass" : "fail";
}

function integer(value: unknown, fallback: number): number {
  const t = text(value);
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function recordOf(value: Node): DmarcReportRecord {
  const row = node(value.row);
  const evaluated = node(row.policy_evaluated);
  const identifiers = node(value.identifiers);
  const auth = node(value.auth_results);
  return {
    sourceIp: text(row.source_ip),
    count: integer(row.count, 0),
    disposition: policyOf(evaluated.disposition, "none"),
    dkim: verdictOf(evaluated.dkim),
    spf: verdictOf(evaluated.spf),
    headerFrom: text(identifiers.header_from).toLowerCase(),
    envelopeFrom: optional(identifiers.envelope_from)?.toLowerCase() ?? null,
    envelopeTo: optional(identifiers.envelope_to)?.toLowerCase() ?? null,
    dkimResults: list(auth.dkim).map((d) => ({
      domain: text(d.domain).toLowerCase(),
      selector: optional(d.selector),
      result: text(d.result).toLowerCase(),
    })),
    spfResults: list(auth.spf).map((s) => ({
      domain: text(s.domain).toLowerCase(),
      scope: optional(s.scope),
      result: text(s.result).toLowerCase(),
    })),
    reasons: list(evaluated.reason).map((r) => ({ type: text(r.type), comment: optional(r.comment) })),
  };
}

export function parseFeedback(xml: string): DmarcFeedback {
  const root = node(parser.parse(xml)).feedback;
  if (!root || typeof root !== "object") throw new Error("not a DMARC aggregate report");

  const feedback = node(root);
  const metadata = node(feedback.report_metadata);
  const range = node(metadata.date_range);
  const published = node(feedback.policy_published);
  const domain = text(published.domain).toLowerCase();
  const reportId = text(metadata.report_id);
  const orgName = text(metadata.org_name);
  if (!domain || !reportId || !orgName) throw new Error("the report names no domain, organisation or report id");

  const p = policyOf(published.p, "none");
  return {
    orgName,
    email: text(metadata.email),
    extraContact: optional(metadata.extra_contact_info),
    reportId,
    begin: integer(range.begin, 0),
    end: integer(range.end, 0),
    policy: {
      domain,
      adkim: modeOf(published.adkim),
      aspf: modeOf(published.aspf),
      p,
      sp: policyOf(published.sp, p),
      pct: integer(published.pct, 100),
    },
    records: list(feedback.record).map(recordOf),
  };
}
