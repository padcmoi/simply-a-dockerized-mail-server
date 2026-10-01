import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiError } from "../common/api-error";
import { Account } from "../entities/account.entity";
import { VirtualAlias } from "../entities/virtual-alias.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { VirtualUser } from "../entities/virtual-user.entity";

export const PROTECTABLE_TYPES = ["account", "recipient", "alias", "domain"] as const;
export type ProtectableType = (typeof PROTECTABLE_TYPES)[number];

@Injectable()
export class ProtectionService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>
  ) {}

  async isProtected(type: ProtectableType, id: string | number) {
    const row = await this.find(type, id);
    return row?.isProtected === 1;
  }

  async assertUnprotected(type: ProtectableType, id: string | number) {
    if (await this.isProtected(type, id)) throw this.locked(type);
  }

  async assertDomainRemovable(domainId: number) {
    const domain = await this.domains.findOne({ select: { domain: true, isProtected: true }, where: { id: domainId } });
    if (!domain) return;
    if (domain.isProtected === 1) throw this.locked("domain");
    const held =
      (await this.recipients.count({ where: { domain: domain.domain, isProtected: 1 } })) +
      (await this.aliases.count({ where: { domain: domain.domain, isProtected: 1 } }));
    if (held > 0) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "protection.domainHoldsProtected",
        "This domain holds a protected mailbox or alias and cannot be deleted",
        { count: held }
      );
    }
  }

  async setProtected(type: ProtectableType, id: string, value: boolean) {
    const row = await this.find(type, id);
    if (!row) throw new NotFoundException(`${type} #${id} not found`);
    const isProtected = value ? 1 : 0;
    if (type === "account") await this.accounts.update({ id }, { isProtected });
    else if (type === "recipient") await this.recipients.update({ id: Number(id) }, { isProtected });
    else if (type === "alias") await this.aliases.update({ id: Number(id) }, { isProtected });
    else await this.domains.update({ id: Number(id) }, { isProtected });
    return row.label;
  }

  private locked(type: ProtectableType) {
    return new ApiError(HttpStatus.FORBIDDEN, "protection.locked", `This ${type} is protected and cannot be changed`, { type });
  }

  private async find(type: ProtectableType, id: string | number) {
    if (type === "account") {
      const row = await this.accounts.findOne({ select: { email: true, isProtected: true }, where: { id: String(id) } });
      return row ? { isProtected: row.isProtected, label: row.email } : null;
    }
    const numeric = Number(id);
    if (!Number.isInteger(numeric)) return null;
    if (type === "recipient") {
      const row = await this.recipients.findOne({ select: { email: true, isProtected: true }, where: { id: numeric } });
      return row ? { isProtected: row.isProtected, label: row.email } : null;
    }
    if (type === "alias") {
      const row = await this.aliases.findOne({ select: { source: true, isProtected: true }, where: { id: numeric } });
      return row ? { isProtected: row.isProtected, label: row.source } : null;
    }
    const row = await this.domains.findOne({ select: { domain: true, isProtected: true }, where: { id: numeric } });
    return row ? { isProtected: row.isProtected, label: row.domain } : null;
  }
}
