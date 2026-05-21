import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebadminAccount } from '../entities';
import { Sha512CryptService } from '../common/sha512-crypt.service';
import { CreateWebadminAccountDto } from './dto/create-webadmin-account.dto';
import { UpdateWebadminAccountDto } from './dto/update-webadmin-account.dto';

@Injectable()
export class WebadminAccountsService {
  constructor(
    @InjectRepository(WebadminAccount)
    private readonly repo: Repository<WebadminAccount>,
    private readonly crypt: Sha512CryptService,
  ) {}

  list() {
    return this.repo.find({
      order: { id: 'ASC' },
      select: ['id', 'email', 'role', 'account_id', 'is_active', 'created_at', 'last_login_at'],
    });
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'role', 'account_id', 'is_active', 'created_at', 'last_login_at'],
    });
    if (!found) throw new NotFoundException(`Webadmin account ${id} not found`);
    return found;
  }

  async create(dto: CreateWebadminAccountDto) {
    if (dto.role === 'root') {
      throw new BadRequestException('Cannot create another root - rotate via install.sh');
    }
    const existing = await this.repo.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existing) throw new ConflictException(`Email ${dto.email} already in use`);

    const password_hash = await this.crypt.hash(dto.password);
    const entity = this.repo.create({
      email: dto.email.trim().toLowerCase(),
      password_hash,
      role: dto.role,
      account_id: dto.account_id ?? null,
      is_active: 1,
    });
    const saved = await this.repo.save(entity);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateWebadminAccountDto) {
    const found = await this.findOne(id);
    if (found.role === 'root') {
      throw new BadRequestException('Cannot mutate the root account here - rotate via install.sh');
    }
    if (dto.role === 'root') {
      throw new BadRequestException('Cannot promote to root');
    }
    await this.repo.update(
      { id: found.id },
      {
        role: dto.role ?? found.role,
        account_id: dto.account_id ?? found.account_id,
        is_active: dto.is_active ?? found.is_active,
      },
    );
    return this.findOne(id);
  }

  async changePassword(id: number, plaintext: string) {
    const found = await this.findOne(id);
    if (found.role === 'root') {
      throw new BadRequestException('Rotate root password via install.sh');
    }
    const password_hash = await this.crypt.hash(plaintext);
    await this.repo.update({ id: found.id }, { password_hash });
    return { id, passwordChanged: true };
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    if (found.role === 'root') {
      throw new BadRequestException('Cannot delete the root account');
    }
    await this.repo.delete({ id: found.id });
    return { id, deleted: true };
  }
}
