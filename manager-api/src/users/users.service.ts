import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { VirtualUser, VirtualDomain } from '../entities';
import { Sha512CryptService } from '../common/sha512-crypt.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(VirtualUser) private readonly users: Repository<VirtualUser>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly crypt: Sha512CryptService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) where.email = ILike(`%${query.search}%`);
    if (query.domain) where.domain = query.domain;
    if (query.activeOnly === 'true') where.active = 1;

    const [items, total] = await this.users.findAndCount({
      where,
      skip: query.page * query.limit,
      take: query.limit,
      order: { email: 'ASC' },
      select: ['id', 'email', 'domain', 'maildir', 'quota', 'active', 'uid', 'gid',
               'owner_id', 'user_start_date', 'user_end_date', 'last_activity'],
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number) {
    const found = await this.users.findOne({
      where: { id },
      select: ['id', 'email', 'domain', 'maildir', 'quota', 'active', 'uid', 'gid',
               'owner_id', 'user_start_date', 'user_end_date', 'last_activity'],
    });
    if (!found) throw new NotFoundException(`User ${id} not found`);
    return found;
  }

  async create(dto: CreateUserDto) {
    if (!this.maildirMatchesEmail(dto.maildir, dto.email, dto.domain)) {
      throw new BadRequestException(
        `maildir must equal '${dto.domain}/<localpart>/' to match Dovecot mail_location`,
      );
    }
    const domain = await this.domains.findOne({ where: { domain: dto.domain } });
    if (!domain) throw new BadRequestException(`Unknown domain: ${dto.domain}`);
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`User ${dto.email} already exists`);

    const hashed = await this.crypt.hash(dto.password);
    const entity = this.users.create({
      email: dto.email,
      domain: dto.domain,
      password: hashed,
      maildir: dto.maildir,
      quota: dto.quota,
      active: dto.active,
      owner_id: dto.owner_id ?? null,
      uid: 'vmail',
      gid: 'vmail',
      user_start_date: dto.user_start_date ?? '1970-01-01',
      user_end_date: dto.user_end_date ?? null,
    });
    const saved = await this.users.save(entity);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateUserDto) {
    const found = await this.findOne(id);
    Object.assign(found, dto);
    await this.users.save(found);
    return this.findOne(id);
  }

  async changePassword(id: number, plaintext: string) {
    const found = await this.findOne(id);
    const hashed = await this.crypt.hash(plaintext);
    await this.users.update({ id: found.id }, { password: hashed });
    return { id, passwordChanged: true };
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    await this.users.delete({ id: found.id });
    return { id, deleted: true };
  }

  private maildirMatchesEmail(maildir: string, email: string, domain: string): boolean {
    const localpart = email.split('@')[0];
    if (!localpart) return false;
    return maildir === `${domain}/${localpart}/`;
  }
}
