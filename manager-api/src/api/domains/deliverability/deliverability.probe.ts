import { get } from "node:http";
import type { CheckResult, CheckSection, CheckStatus } from "./deliverability.types";

// The manager does not run the checks. `mail-deliverability-probe` does, from
// outside every docker network, because postfix trusts `mynetworks` and would
// answer this container the way it answers a client it has been told to trust:
// an open relay test asked from here comes back `250` whatever the truth is.
// See docker/services/deliverability-probe.yml.

export interface ProbeReport {
  domain: string;
  mxHost: string | null;
  mailIp: string | null;
  source: string;
  counts: Record<CheckStatus, number>;
  checks: CheckResult[];
}

export interface ProbeAnswer {
  report: ProbeReport | null;
  error: string | null;
}

const TIMEOUT_MS = 120_000;

export function askProbe(domain: string, selector: string, base = process.env.DELIVERABILITY_PROBE_URL): Promise<ProbeAnswer> {
  if (!base) return Promise.resolve({ report: null, error: "no probe configured" });

  const url = `${base.replace(/\/$/, "")}/report?domain=${encodeURIComponent(domain)}&selector=${encodeURIComponent(selector)}`;
  return new Promise<ProbeAnswer>((resolve) => {
    const req = get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ report: JSON.parse(body) as ProbeReport, error: null });
        } catch {
          resolve({ report: null, error: "unreadable answer" });
        }
      });
    });
    req.once("error", (e) => resolve({ report: null, error: e.message }));
    req.once("timeout", () => {
      req.destroy();
      resolve({ report: null, error: "timeout" });
    });
  });
}

export const SECTIONS: CheckSection[] = ["identity", "dns", "server", "reputation"];
