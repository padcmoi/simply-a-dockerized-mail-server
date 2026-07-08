import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { resolveTxt } from "node:dns/promises";
import { Repository } from "typeorm";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";

export type StaleSelectorHint = {
  selector: string;
  queriedName: string;
  txtRecord: string;
};

export type DkimCheckResult = {
  domain: string;
  hasKeyInDatabase: boolean;
  match: boolean;
  checkedAt: string;
  error: string | null;
  staleSelectorFound: StaleSelectorHint | null;
  expected: { selector: string; queriedName: string; value: string } | null;
  found: { value: string } | null;
};

// Selectors this project's OpenDKIM sidecar generates are always
// `dkim<YYYYMM>` (see images/opendkim/dkim-api.py:_default_selector),
// rotating monthly. Not a guess -- that convention is what lets us look for
// last month's record when the current one is missing, instead of only
// reporting "not found" with no lead on why.
const SELECTOR_MONTH_RE = /^dkim(\d{4})(\d{2})$/;

@Injectable()
export class DkimCheckService {
  private readonly log = new Logger(DkimCheckService.name);

  constructor(
    @InjectRepository(DkimKeyEntity)
    private readonly repo: Repository<DkimKeyEntity>
  ) {}

  // A domain having no persisted key is a valid state (DKIM is optional per
  // domain) -- `hasKeyInDatabase: false` with `expected`/`found` both null
  // distinguishes that from an actual DNS mismatch. `rotate()` on the DKIM
  // module always leaves exactly one active selector per domain, so the
  // latest row is "the" key to check.
  async check(domain: string): Promise<DkimCheckResult> {
    const checkedAt = new Date().toISOString();
    const key = await this.repo.findOne({ where: { domain }, order: { updatedAt: "DESC" } });

    if (!key) {
      return {
        domain,
        hasKeyInDatabase: false,
        match: false,
        checkedAt,
        error: null,
        staleSelectorFound: null,
        expected: null,
        found: null,
      };
    }

    const queriedName = `${key.dnsName}.${domain}`;
    const expected = { selector: key.selector, queriedName, value: key.txtRecord };

    try {
      // A TXT record's value can be split across multiple quoted strings by
      // the nameserver (long DKIM keys almost always are); each inner array
      // is one record's chunks, which must be concatenated back together
      // before the `p=` value inside it means anything.
      const records = (await resolveTxt(queriedName)).map((chunks) => chunks.join(""));
      const foundValue = records.find((r) => r.includes("p=")) ?? records[0] ?? null;
      const match = foundValue !== null && this.extractPublicKey(foundValue) === this.extractPublicKey(expected.value);

      return {
        domain,
        hasKeyInDatabase: true,
        match,
        checkedAt,
        error: null,
        staleSelectorFound: null,
        expected,
        found: foundValue !== null ? { value: foundValue } : null,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.log.warn(`DKIM DNS check failed for ${queriedName}: ${error}`);
      const staleSelectorFound = await this.findStaleSelector(domain, key.selector);

      return { domain, hasKeyInDatabase: true, match: false, checkedAt, error, staleSelectorFound, expected, found: null };
    }
  }

  // The current selector's TXT wasn't found: check whether last month's
  // selector (the one before rotation) is still published, which is exactly
  // what happens when someone rotates the key but forgets to update DNS.
  private async findStaleSelector(domain: string, currentSelector: string): Promise<StaleSelectorHint | null> {
    const m = currentSelector.match(SELECTOR_MONTH_RE);
    if (!m) return null;

    const year = Number(m[1]);
    const month = Number(m[2]);
    const prevDate = new Date(Date.UTC(year, month - 2, 1)); // month is 1-based in the selector, JS Date is 0-based
    const prevSelector = `dkim${prevDate.getUTCFullYear()}${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const queriedName = `${prevSelector}._domainkey.${domain}`;

    try {
      const records = (await resolveTxt(queriedName)).map((chunks) => chunks.join(""));
      const txtRecord = records.find((r) => r.includes("p=")) ?? records[0] ?? null;
      return txtRecord ? { selector: prevSelector, queriedName, txtRecord } : null;
    } catch {
      return null;
    }
  }

  private extractPublicKey(txtRecord: string): string {
    const match = txtRecord.match(/p=([^;\s]+)/);
    return match ? match[1] : "";
  }
}
