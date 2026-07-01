import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { sha512crypt } from "../../../core/common/sha512-crypt";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { CreateRecipientDto, UpdateRecipientDto } from "./recipients.validation";

// VirtualUser is the ORM mapping for the `virtual_users` postfix table; the
// table name is dictated by postfix conventions and not under our control.
// Everywhere else we speak in terms of "recipient" (RFC 5321 nomenclature):
// what postfix stores as `virtual_users.email` is the recipient address of
// inbound mail. This service is the public surface; the entity name stays
// `VirtualUser` so the entity-to-table mapping reads cleanly.
@Injectable()
export class RecipientsService {
  constructor(
    @InjectRepository(VirtualUser)
    private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualDomain)
    private readonly domains: Repository<VirtualDomain>
  ) {}

  // Resolve the parent domain from `:domainId` and return its `domain`
  // string (FQDN). 404s on unknown parent: every nested handler must call
  // this first so its work never crosses a domain boundary.
  async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  list(domain: string) {
    return this.recipients.find({ where: { domain }, order: { email: "ASC" } });
  }

  async get(id: number, domain: string) {
    const found = await this.recipients.findOne({ where: { id, domain } });
    if (!found) throw new NotFoundException(`Recipient #${id} not found in ${domain}`);
    return found;
  }

  async create(input: CreateRecipientDto, domain: string) {
    const email = `${input.localPart}@${domain}`;
    if (await this.recipients.findOne({ where: { email } })) {
      throw new ConflictException(`Recipient ${email} already exists`);
    }
    return this.recipients.save(
      this.recipients.create({
        email,
        domain,
        password: await sha512crypt(input.password),
        maildir: `${domain}/${input.localPart}/`,
        quota: String(input.quota ?? 524_288_000),
        active: input.active === false ? 0 : 1,
        uid: "vmail",
        gid: "vmail",
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  async update(id: number, input: UpdateRecipientDto, domain: string) {
    const current = await this.get(id, domain);
    if (input.password) current.password = await sha512crypt(input.password);
    if (input.quota !== undefined) current.quota = String(input.quota);
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.recipients.save(current);
  }

  async remove(id: number, domain: string) {
    await this.recipients.remove(await this.get(id, domain));
    return { ok: true };
  }
}
