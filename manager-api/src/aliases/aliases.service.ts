import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { VirtualAlias } from '../entities';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-alias.dto';

@Injectable()
export class AliasesService {
  constructor(@InjectRepository(VirtualAlias) private readonly repo: Repository<VirtualAlias>) {}

  async list(page = 0, limit = 50, search?: string, domain?: string) {
    const where: Record<string, unknown> = {};
    if (search) where.source = ILike(`%${search}%`);
    if (domain) where.domain = domain;
    const [items, total] = await this.repo.findAndCount({
      where,
      skip: page * limit,
      take: limit,
      order: { source: 'ASC' },
    });
    return { items, total, page, limit };
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Alias ${id} not found`);
    return found;
  }

  async create(dto: CreateAliasDto) {
    const existing = await this.repo.findOne({ where: { source: dto.source } });
    if (existing) throw new ConflictException(`Alias source ${dto.source} already exists`);
    return this.repo.save(
      this.repo.create({
        domain: dto.domain,
        source: dto.source,
        destination: dto.destination,
        owner_id: dto.owner_id ?? null,
        user_start_date: dto.user_start_date ?? '1970-01-01',
        user_end_date: dto.user_end_date ?? null,
      }),
    );
  }

  async update(id: number, dto: UpdateAliasDto) {
    const found = await this.findOne(id);
    Object.assign(found, dto);
    return this.repo.save(found);
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    await this.repo.remove(found);
    return { id, deleted: true };
  }
}
