import { pipeline } from "../../../core/common/redis";
import type { DeliverabilityReport } from "./deliverability.types";

// The report is kept in redis, and nothing but a deliberate re-run replaces it.
//
// A run is not free: it opens an SMTP session against the server, fetches an
// HTTPS policy and queries public blocklists in this installation's name. Doing
// that on every page view would spend those calls on a reader who only wanted to
// look at what was found last time, and would hammer the blocklists with a rate
// they refuse. So the page reads the stored answer, and the button is what pays
// for a new one.
//
// No expiry on purpose: a report going missing on its own would put the reader
// back in front of an empty page for no reason they can see. It lives until it
// is replaced.

const KEY = (domain: string) => `deliverability:report:${domain.toLowerCase()}`;

export async function readStoredReport(domain: string): Promise<DeliverabilityReport | null> {
  try {
    const [value] = await pipeline([["GET", KEY(domain)]]);
    return typeof value === "string" ? (JSON.parse(value) as DeliverabilityReport) : null;
  } catch {
    // Redis down, or a value this version cannot read: the caller runs the
    // checks instead. A cache that fails is a slow page, never a broken one.
    return null;
  }
}

export async function storeReport(report: DeliverabilityReport): Promise<void> {
  try {
    await pipeline([["SET", KEY(report.domain), JSON.stringify(report)]]);
  } catch {
    // The report was produced and is about to be served; failing to keep a copy
    // is not a reason to lose it.
  }
}

export async function forgetReport(domain: string): Promise<void> {
  try {
    await pipeline([["DEL", KEY(domain)]]);
  } catch {
    // Nothing to do: the next run overwrites it anyway.
  }
}
