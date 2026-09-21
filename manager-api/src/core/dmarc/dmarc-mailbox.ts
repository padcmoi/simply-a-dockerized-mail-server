import { randomBytes } from "crypto";
import type { EntityManager } from "typeorm";
import { sha512crypt } from "../common/sha512-crypt";
import { DMARC_REPORTS_LOCAL_PART, dmarcReportsAddress } from "../common/reserved-mailboxes";
import { VirtualUser } from "../entities/virtual-user.entity";

export async function ensureDmarcReportsMailbox(
  manager: EntityManager,
  domain: string
): Promise<"created" | "reactivated" | "present"> {
  const email = dmarcReportsAddress(domain);
  const existing = await manager.findOne(VirtualUser, { where: { email } });
  if (existing) {
    if (existing.active === 1) return "present";
    await manager.save(VirtualUser, { ...existing, active: 1 });
    return "reactivated";
  }
  await manager.save(VirtualUser, {
    email,
    domain,
    password: await sha512crypt(randomBytes(24).toString("hex")),
    maildir: `${domain}/${DMARC_REPORTS_LOCAL_PART}/`,
    quota: "0",
    active: 1,
    uid: "vmail",
    gid: "vmail",
    userStartDate: new Date().toISOString().slice(0, 10),
    userEndDate: null,
  });
  return "created";
}
