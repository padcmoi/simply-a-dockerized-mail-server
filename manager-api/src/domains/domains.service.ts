import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DkimKey, DkimService } from "../dkim/dkim.service";
import { CreateDomainDto, UpdateDomainDto } from "./domains.validation";
import { VirtualDomain } from "./virtual-domain.entity";

@Injectable()
export class DomainsService {
  private readonly log = new Logger(DomainsService.name);

  constructor(
    @InjectRepository(VirtualDomain) private readonly repo: Repository<VirtualDomain>,
    private readonly dkim: DkimService
  ) {}

  list() {
    return this.repo.find({ order: { domain: "ASC" } });
  }

  async get(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Domain #${id} not found`);
    return found;
  }

  async create(input: CreateDomainDto) {
    if (await this.repo.findOne({ where: { domain: input.domain } })) {
      throw new ConflictException(`Domain ${input.domain} already exists`);
    }
    const saved = await this.repo.save(
      this.repo.create({
        domain: input.domain,
        quota: String(input.quota ?? 0),
        active: input.active ? 1 : 0,
        ownerId: input.ownerId ?? null,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
    let dkim: DkimKey | null = null;
    try {
      dkim = await this.dkim.create(saved.domain);
    } catch (e) {
      this.log.warn(`DKIM key generation failed for ${saved.domain}: ${(e as Error).message}`);
    }
    return { ...saved, dkim };
  }

  async update(id: number, input: UpdateDomainDto) {
    const current = await this.get(id);
    if (input.domain !== undefined) current.domain = input.domain;
    if (input.quota !== undefined) current.quota = String(input.quota);
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.ownerId !== undefined) current.ownerId = input.ownerId;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.repo.save(current);
  }

  async remove(id: number) {
    const target = await this.get(id);
    await this.dkim.removeAll(target.domain).catch((e) => {
      this.log.warn(`DKIM cleanup failed for ${target.domain}: ${(e as Error).message}`);
    });
    await this.repo.remove(target);
    return { ok: true };
  }

  listDkim(domain: string) {
    return this.dkim.list(domain);
  }

  rotateDkim(domain: string) {
    return this.dkim.create(domain);
  }

  removeDkim(domain: string, selector: string) {
    return this.dkim.remove(domain, selector);
  }
}
