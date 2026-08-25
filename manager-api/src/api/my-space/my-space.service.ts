import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { AliasesService } from "../domains/aliases/aliases.service";
import { CreateAliasDto } from "../domains/aliases/aliases.validation";
import { DelegationsService } from "../domains/delegations/delegations.service";
import { RecipientsService } from "../domains/recipients/recipients.service";
import { CreateRecipientDto } from "../domains/recipients/recipients.validation";
import { UpdateMyAliasDto, UpdateMyRecipientDto } from "./my-space.validation";

// The personal space: an account managing the recipients and aliases it owns,
// authorized on ownership alone (owner_id === caller), never on a domain ACL.
// A resource the caller does not own is reported as absent, never forbidden, so
// this surface never reveals the existence of a mailbox or alias that is not
// theirs. The mail-side invariants (password hashing, postmaster protection,
// on-disk cleanup) stay in RecipientsService / AliasesService, reused here.
@Injectable()
export class MySpaceService {
  constructor(
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    private readonly recipientsSvc: RecipientsService,
    private readonly aliasesSvc: AliasesService,
    private readonly delegationsSvc: DelegationsService
  ) {}

  private async ownedRecipient(userId: string, id: number) {
    const recipient = await this.recipients.findOne({ where: { id, ownerId: userId } });
    if (!recipient) throw new NotFoundException(`Recipient #${id} not found`);
    return recipient;
  }

  private async ownedAlias(userId: string, id: number) {
    const alias = await this.aliases.findOne({ where: { id, ownerId: userId } });
    if (!alias) throw new NotFoundException(`Alias #${id} not found`);
    return alias;
  }

  // Mapped down to the fields the owner manages: the row also carries the
  // password hash, uid/gid and maildir, none of which leave the server.
  async getRecipient(userId: string, id: number) {
    const recipient = await this.ownedRecipient(userId, id);
    const withUsage = await this.recipientsSvc.getWithUsage(recipient.id, recipient.domain);
    return {
      id: withUsage.id,
      email: withUsage.email,
      domain: withUsage.domain,
      quota: withUsage.quota,
      usedBytes: withUsage.usedBytes,
      active: withUsage.active === 1,
    };
  }

  // A quota change is delegation business: the raise spends the caller's
  // delegated budget on the mailbox's domain (a lowering frees it), and the
  // domain-level quota check is skipped because that space is already
  // immobilized by the delegation's reserve.
  async updateRecipient(userId: string, id: number, input: UpdateMyRecipientDto) {
    const recipient = await this.ownedRecipient(userId, id);
    if (input.quota !== undefined) {
      await this.delegationsSvc.assertCanRaiseQuota(userId, recipient.domain, input.quota - Number(recipient.quota));
    }
    await this.recipientsSvc.update(recipient.id, input, recipient.domain, { skipDomainQuota: input.quota !== undefined });
    return this.getRecipient(userId, id);
  }

  async deleteRecipient(userId: string, id: number) {
    const recipient = await this.ownedRecipient(userId, id);
    return this.recipientsSvc.remove(recipient.id, recipient.domain);
  }

  async getAlias(userId: string, id: number) {
    const alias = await this.ownedAlias(userId, id);
    return { id: alias.id, source: alias.source, destination: alias.destination, domain: alias.domain };
  }

  async updateAlias(userId: string, id: number, input: UpdateMyAliasDto) {
    const alias = await this.ownedAlias(userId, id);
    await this.aliasesSvc.update(alias.id, { destination: input.destination }, alias.domain);
    return this.getAlias(userId, id);
  }

  async deleteAlias(userId: string, id: number) {
    const alias = await this.ownedAlias(userId, id);
    return this.aliasesSvc.remove(alias.id, alias.domain);
  }

  // The delegations the caller holds, with usage: the personal space's
  // "create on a delegated domain" category feeds on this.
  myDelegations(userId: string) {
    return this.delegationsSvc.myDelegations(userId);
  }

  // Delegated self-service creation: authorized by the caller's delegation row
  // (caps + granted quota, checked in DelegationsService), created owned.
  async createRecipient(userId: string, domainId: number, input: CreateRecipientDto) {
    const domain = await this.recipientsSvc.resolveDomain(domainId);
    await this.delegationsSvc.assertCanCreateRecipient(userId, domainId, input.quota);
    const created = await this.recipientsSvc.create(input, domain, { ownerId: userId, skipDomainQuota: true });
    return this.getRecipient(userId, created.id);
  }

  async createAlias(userId: string, domainId: number, input: CreateAliasDto) {
    const domain = await this.aliasesSvc.resolveDomain(domainId);
    await this.delegationsSvc.assertCanCreateAlias(userId, domainId);
    const created = await this.aliasesSvc.create(input, domain, { ownerId: userId });
    return this.getAlias(userId, created.id);
  }
}
