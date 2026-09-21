import type { DkimSignature, DmarcAlignmentMode, DmarcEvaluationInput, DmarcPolicy, DmarcVerdict } from "./dmarc.types";

const AUTH_RESULTS: Record<string, string> = {
  "0": "pass",
  "2": "softfail",
  "3": "neutral",
  "4": "temperror",
  "5": "permerror",
  "6": "none",
  "7": "fail",
  "8": "policy",
  "9": "nxdomain",
  "10": "signed",
  "12": "discard",
};

const POLICIES: Record<string, DmarcPolicy> = {
  [String("n".charCodeAt(0))]: "none",
  [String("q".charCodeAt(0))]: "quarantine",
  [String("r".charCodeAt(0))]: "reject",
};

const MODES: Record<string, DmarcAlignmentMode> = { [String("r".charCodeAt(0))]: "r", [String("s".charCodeAt(0))]: "s" };

export function authResult(code: string | undefined): string {
  return (code !== undefined && AUTH_RESULTS[code]) || "unknown";
}

export function alignment(code: string | undefined): DmarcVerdict {
  return code === "4" ? "pass" : "fail";
}

export function disposition(code: string | undefined): DmarcPolicy {
  if (code === "0" || code === "1") return "reject";
  if (code === "4") return "quarantine";
  return "none";
}

export function policyOf(code: string | undefined): DmarcPolicy | null {
  return (code !== undefined && POLICIES[code]) || null;
}

export function modeOf(code: string | undefined): DmarcAlignmentMode {
  return (code !== undefined && MODES[code]) || "r";
}

interface Draft {
  fields: Map<string, string>;
  dkim: DkimSignature[];
  rua: string[];
}

function emptyDraft(): Draft {
  return { fields: new Map(), dkim: [], rua: [] };
}

function finish(draft: Draft): DmarcEvaluationInput | null {
  const f = draft.fields;
  const jobId = f.get("job");
  const sourceIp = f.get("ipaddr");
  const headerFrom = f.get("from")?.toLowerCase();
  const received = Number(f.get("received"));
  if (!jobId || !sourceIp || !headerFrom || !Number.isFinite(received)) return null;

  const pct = Number(f.get("pct"));
  return {
    jobId,
    reporter: f.get("reporter") ?? "",
    receivedAt: received * 1000,
    sourceIp,
    headerFrom,
    envelopeFrom: f.get("mfrom")?.toLowerCase() || null,
    policyDomain: f.get("pdomain")?.toLowerCase() || headerFrom,
    spfResult: authResult(f.get("spf")),
    dkim: draft.dkim,
    dkimAligned: alignment(f.get("align_dkim")),
    spfAligned: alignment(f.get("align_spf")),
    disposition: disposition(f.get("action")),
    policy: policyOf(f.get("p")),
    subdomainPolicy: policyOf(f.get("sp")),
    adkim: modeOf(f.get("adkim")),
    aspf: modeOf(f.get("aspf")),
    pct: Number.isFinite(pct) && f.get("pct") !== undefined ? pct : 100,
    rua: draft.rua,
  };
}

export function parseHistory(text: string): DmarcEvaluationInput[] {
  const evaluations: DmarcEvaluationInput[] = [];
  let draft: Draft | null = null;

  const close = () => {
    if (!draft) return;
    const evaluation = finish(draft);
    if (evaluation) evaluations.push(evaluation);
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.startsWith(" ")) continue;
    const [key, value = "", ...rest] = line.split(" ");
    if (!key) continue;

    if (key === "job") {
      close();
      draft = emptyDraft();
    }
    if (!draft) continue;

    if (key === "dkim") {
      draft.dkim.push({ domain: value.toLowerCase(), selector: rest[0] ?? "", result: authResult(rest[1]) });
    } else if (key === "rua") {
      if (value && value !== "-") draft.rua.push(value);
    } else {
      draft.fields.set(key, value);
    }
  }
  close();

  return evaluations;
}
