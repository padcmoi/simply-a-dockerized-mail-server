import { createHmac, randomBytes } from "crypto";
import type { EntityManager } from "typeorm";
import { sha512crypt, sha512cryptMatches } from "../common/sha512-crypt";
import { DMARC_REPORTS_LOCAL_PART, dmarcReportsAddress } from "../common/reserved-mailboxes";
import { VirtualUser } from "../entities/virtual-user.entity";

export const DMARC_REPORTS_QUOTA_BYTES = 100 * 1024 * 1024;

export function dmarcReportsPassword(address: string): string | null {
  const pepper = process.env.MANAGER_API_TOKEN_PEPPER;
  if (!pepper) return null;
  return createHmac("sha256", pepper).update(`dmarc-reports-imap:${address.toLowerCase()}`).digest("hex");
}

export async function ensureDmarcReportsMailbox(
  manager: EntityManager,
  domain: string
): Promise<"created" | "reactivated" | "updated" | "present"> {
  const email = dmarcReportsAddress(domain);
  const quota = String(DMARC_REPORTS_QUOTA_BYTES);
  const password = dmarcReportsPassword(email);
  const existing = await manager.findOne(VirtualUser, { where: { email } });
  if (existing) {
    const hash =
      password !== null && !(await sha512cryptMatches(password, existing.password)) ? await sha512crypt(password) : null;
    if (existing.active === 1 && String(existing.quota) === quota && hash === null) return "present";
    await manager.save(VirtualUser, { ...existing, active: 1, quota, ...(hash === null ? {} : { password: hash }) });
    return existing.active === 1 ? "updated" : "reactivated";
  }
  await manager.save(VirtualUser, {
    email,
    domain,
    password: await sha512crypt(password ?? randomBytes(24).toString("hex")),
    maildir: `${domain}/${DMARC_REPORTS_LOCAL_PART}/`,
    quota,
    active: 1,
    uid: "vmail",
    gid: "vmail",
    userStartDate: new Date().toISOString().slice(0, 10),
    userEndDate: null,
  });
  return "created";
}
