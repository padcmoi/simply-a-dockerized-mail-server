import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SieveRejectSender } from '../entities';
import { CreateSieveRejectDto } from './dto/create-sieve-reject.dto';

@Injectable()
export class SieveService {
  constructor(
    @InjectRepository(SieveRejectSender)
    private readonly repo: Repository<SieveRejectSender>,
  ) {}

  list() {
    return this.repo.find({ order: { sender: 'ASC' } });
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Sieve reject rule ${id} not found`);
    return found;
  }

  async create(dto: CreateSieveRejectDto) {
    const existing = await this.repo.findOne({ where: { sender: dto.sender } });
    if (existing) throw new ConflictException(`Reject rule for ${dto.sender} already exists`);
    return this.repo.save(this.repo.create({ sender: dto.sender, enabled: dto.enabled }));
  }

  async toggle(id: number, enabled: number) {
    await this.findOne(id);
    await this.repo.update({ id }, { enabled });
    return this.findOne(id);
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    await this.repo.remove(found);
    return { id, deleted: true };
  }
}
