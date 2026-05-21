import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VirtualQuotaDomain, VirtualQuotaUser } from '../entities';

/**
 * Read-only views over the quota tables. Writes are owned by Dovecot's quota plugin.
 */
@Injectable()
export class QuotasService {
  constructor(
    @InjectRepository(VirtualQuotaDomain)
    private readonly domains: Repository<VirtualQuotaDomain>,
    @InjectRepository(VirtualQuotaUser)
    private readonly users: Repository<VirtualQuotaUser>,
  ) {}

  listDomains() {
    return this.domains.find({ order: { domain: 'ASC' } });
  }

  listUsers(domain?: string) {
    return this.users.find({ where: domain ? { domain } : {}, order: { email: 'ASC' } });
  }

  async getDomain(domain: string) {
    const found = await this.domains.findOne({ where: { domain } });
    if (!found) throw new NotFoundException(`No quota row for domain ${domain}`);
    return found;
  }

  async getUser(email: string) {
    const found = await this.users.findOne({ where: { email } });
    if (!found) throw new NotFoundException(`No quota row for user ${email}`);
    return found;
  }
}
