import { Injectable } from "@nestjs/common";
import { promises as dns } from "dns";
import { dmarcReportsAddress } from "../../../core/common/reserved-mailboxes";

const DEFAULT_TAGS: [string, string][] = [
  ["v", "DMARC1"],
  ["p", "none"],
  ["rua", ""],
  ["fo", "1"],
  ["adkim", "r"],
  ["aspf", "r"],
];

export function parseDmarcTags(record: string): [string, string][] {
  return record
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf("=");
      return (at < 0 ? [part.toLowerCase(), ""] : [part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()]) as [
        string,
        string,
      ];
    });
}

function ruaAddresses(value: string) {
  return value
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

export function reportsTo(record: string | null, mailbox: string): boolean {
  if (!record) return false;
  const rua = parseDmarcTags(record).find(([key]) => key === "rua")?.[1] ?? "";
  return ruaAddresses(rua).some((uri) => uri.toLowerCase().replace(/!.*$/, "") === `mailto:${mailbox}`);
}

export function recommendedDmarcRecord(domain: string, published: string | null): string {
  const mailbox = dmarcReportsAddress(domain);
  const tags = published ? parseDmarcTags(published) : DEFAULT_TAGS.map(([key, value]) => [key, value] as [string, string]);
  if (!tags.length || tags[0]?.[0] !== "v") tags.unshift(["v", "DMARC1"]);
  if (!tags.some(([key]) => key === "p")) tags.splice(1, 0, ["p", "none"]);

  const ours = `mailto:${mailbox}`;
  const rua = tags.find(([key]) => key === "rua");
  if (!rua) {
    const after = tags.findIndex(([key]) => key === "p");
    tags.splice(after + 1, 0, ["rua", ours]);
  } else if (!reportsTo(`rua=${rua[1]}`, mailbox)) {
    rua[1] = [ours, ...ruaAddresses(rua[1])].join(",");
  }
  return tags.map(([key, value]) => (value === "" ? key : `${key}=${value}`)).join("; ");
}

@Injectable()
export class DmarcRecordService {
  async published(domain: string): Promise<{ record: string | null; error: string | null }> {
    try {
      const records = (await dns.resolveTxt(`_dmarc.${domain}`)).map((chunks) => chunks.join("").trim());
      return { record: records.find((record) => /^v=dmarc1\b/i.test(record)) ?? null, error: null };
    } catch (e) {
      return { record: null, error: (e as NodeJS.ErrnoException).code ?? (e as Error).message };
    }
  }

  async describe(domain: string) {
    const name = domain.toLowerCase();
    const mailbox = dmarcReportsAddress(name);
    const { record, error } = await this.published(name);
    return {
      dnsName: `_dmarc.${name}`,
      txtRecord: recommendedDmarcRecord(name, record),
      mailbox,
      published: record,
      reportsHere: reportsTo(record, mailbox),
      error,
    };
  }
}
