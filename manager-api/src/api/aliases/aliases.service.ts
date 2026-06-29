import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { CreateAliasDto, UpdateAliasDto } from "./aliases.validation";

@Injectable()
export class AliasesService {
  constructor(@InjectRepository(VirtualAlias) private readonly repo: Repository<VirtualAlias>) {}

  list(domain?: string) {
    return this.repo.find({ where: domain ? { domain } : {}, order: { source: "ASC" } });
  }

  async get(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Alias #${id} not found`);
    return found;
  }

  async create(input: CreateAliasDto) {
    if (await this.repo.findOne({ where: { source: input.source } })) {
      throw new ConflictException(`Alias ${input.source} already exists`);
    }
    const [, domain] = input.source.split("@");
    return this.repo.save(
      this.repo.create({
        source: input.source,
        destination: input.destination,
        domain,
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  async update(id: number, input: UpdateAliasDto) {
    const current = await this.get(id);
    if (input.destination !== undefined) current.destination = input.destination;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.repo.save(current);
  }

  async remove(id: number) {
    await this.repo.remove(await this.get(id));
    return { ok: true };
  }
}
