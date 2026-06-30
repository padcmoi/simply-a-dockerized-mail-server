import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CreateAliasDto, UpdateAliasDto } from "./aliases.validation";

@Injectable()
export class AliasesService {
  constructor(
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>
  ) {}

  async resolveDomain(domainId: number): Promise<string> {
    const found = await this.domains.findOne({ where: { id: domainId } });
    if (!found) throw new NotFoundException(`Domain #${domainId} not found`);
    return found.domain;
  }

  list(domain: string) {
    return this.aliases.find({ where: { domain }, order: { source: "ASC" } });
  }

  async get(id: number, domain: string) {
    const found = await this.aliases.findOne({ where: { id, domain } });
    if (!found) throw new NotFoundException(`Alias #${id} not found in ${domain}`);
    return found;
  }

  async create(input: CreateAliasDto, domain: string) {
    const source = `${input.localPart}@${domain}`;
    if (await this.aliases.findOne({ where: { source } })) {
      throw new ConflictException(`Alias ${source} already exists`);
    }
    return this.aliases.save(
      this.aliases.create({
        source,
        destination: input.destination,
        domain,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  async update(id: number, input: UpdateAliasDto, domain: string) {
    const current = await this.get(id, domain);
    if (input.destination !== undefined) current.destination = input.destination;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.aliases.save(current);
  }

  async remove(id: number, domain: string) {
    await this.aliases.remove(await this.get(id, domain));
    return { ok: true };
  }
}
