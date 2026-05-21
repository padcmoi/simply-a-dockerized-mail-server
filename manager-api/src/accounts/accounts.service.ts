import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(@InjectRepository(Account) private readonly repo: Repository<Account>) {}

  list() {
    return this.repo.find({ order: { username: 'ASC' } });
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Account ${id} not found`);
    return found;
  }

  async create(dto: CreateAccountDto) {
    const existing = await this.repo.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException(`Account ${dto.username} already exists`);
    return this.repo.save(this.repo.create({ username: dto.username }));
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    await this.repo.remove(found);
    return { id, deleted: true };
  }
}
