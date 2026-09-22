import { randomBytes } from "crypto";
import type { EntityManager } from "typeorm";
import { sha512crypt } from "../common/sha512-crypt";
import { DMARC_REPORTS_LOCAL_PART, dmarcReportsAddress } from "../common/reserved-mailboxes";
import { VirtualUser } from "../entities/virtual-user.entity";

export const DMARC_REPORTS_QUOTA_BYTES = 100 * 1024 * 1024;

export async function ensureDmarcReportsMailbox(
  manager: EntityManager,
  domain: string
): Promise<"created" | "reactivated" | "resized" | "present"> {
  const email = dmarcReportsAddress(domain);
  const quota = String(DMARC_REPORTS_QUOTA_BYTES);
  const existing = await manager.findOne(VirtualUser, { where: { email } });
  if (existing) {
    if (existing.active === 1 && String(existing.quota) === quota) return "present";
    await manager.save(VirtualUser, { ...existing, active: 1, quota });
    return existing.active === 1 ? "resized" : "reactivated";
  }
  await manager.save(VirtualUser, {
    email,
    domain,
    password: await sha512crypt(randomBytes(24).toString("hex")),
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
