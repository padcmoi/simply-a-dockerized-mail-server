import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { VirtualDomain } from '../entities';
import { OpendkimService } from '../infra/opendkim.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { ListDomainsQueryDto } from './dto/list-domains-query.dto';
import { DnsRecordDto, DomainWithDnsDto } from './dto/dns-records.dto';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);
  private readonly mailServerFqdn: string;

  constructor(
    @InjectRepository(VirtualDomain) private readonly repo: Repository<VirtualDomain>,
    private readonly opendkim: OpendkimService,
    config: ConfigService,
  ) {
    // Mail server FQDN - used as the MX target for every managed domain
    this.mailServerFqdn = config.get<string>('DOMAIN_FQDN') ?? '';
  }

  async list(query: ListDomainsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) where.domain = ILike(`%${query.search}%`);
    if (query.activeOnly === 'true') where.active = 1;

    const [items, total] = await this.repo.findAndCount({
      where,
      skip: query.page * query.limit,
      take: query.limit,
      order: { domain: 'ASC' },
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Domain ${id} not found`);
    return found;
  }

  async findByDomain(domain: string) {
    return this.repo.findOne({ where: { domain } });
  }

  /**
   * Create a domain, auto-generate its DKIM key (selector `dkim_YYYY_MM`),
   * and return the DNS records the user must publish for the domain to deliver mail.
   */
  async create(dto: CreateDomainDto): Promise<DomainWithDnsDto> {
    const existing = await this.findByDomain(dto.domain);
    if (existing) throw new ConflictException(`Domain ${dto.domain} already exists`);

    const entity = this.repo.create({
      domain: dto.domain,
      quota: dto.quota,
      active: dto.active,
      owner_id: dto.owner_id ?? null,
      user_start_date: dto.user_start_date ?? '1970-01-01',
      user_end_date: dto.user_end_date ?? null,
    });
    const saved = await this.repo.save(entity);

    const selector = this.currentDkimSelector();
    let dkimTxt: string | undefined;
    try {
      const txt = await this.opendkim.createKey(dto.domain, selector);
      dkimTxt = this.extractDkimTxtRecord(txt);
    } catch (err) {
      this.logger.warn(`DKIM keygen failed for ${dto.domain}: ${(err as Error).message}`);
    }

    return {
      domain: saved,
      dkim_selector: selector,
      dns: this.buildDnsRecords(dto.domain, selector, dkimTxt),
    };
  }

  async update(id: number, dto: UpdateDomainDto) {
    const found = await this.findOne(id);
    Object.assign(found, dto);
    return this.repo.save(found);
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    // FK CASCADE drops VirtualUsers, VirtualAliases, VirtualQuota* for this domain.
    // This is irreversible - the controller gates with @Roles('admin') (root bypasses).
    await this.repo.remove(found);
    return { id, deleted: true };
  }

  /** Get the DNS records the user must publish for an existing domain. */
  async dns(id: number): Promise<DomainWithDnsDto> {
    const found = await this.findOne(id);
    const selector = this.currentDkimSelector();
    return {
      domain: found,
      dkim_selector: selector,
      dns: this.buildDnsRecords(found.domain, selector),
    };
  }

  private currentDkimSelector(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `dkim_${y}_${m}`;
  }

  private extractDkimTxtRecord(genkeyOutput: string): string | undefined {
    // opendkim-genkey emits a `selector._domainkey IN TXT ( "v=DKIM1; ..." )` line
    const match = genkeyOutput.match(/"([^"]+)"\s*(?:"([^"]+)")?/);
    if (!match) return undefined;
    return (match[1] + (match[2] ?? '')).replace(/\s+/g, '');
  }

  private buildDnsRecords(domain: string, selector: string, dkimTxt?: string): DnsRecordDto[] {
    const mx = this.mailServerFqdn || `mail.${domain}`;
    const records: DnsRecordDto[] = [
      {
        type: 'MX',
        name: '@',
        value: `${mx}.`,
        priority: 10,
        description: 'Points incoming mail to this server',
      },
      {
        type: 'TXT',
        name: '@',
        value: `v=spf1 mx ~all`,
        description: 'SPF - authorizes the MX host to send mail for this domain',
      },
      {
        type: 'TXT',
        name: `${selector}._domainkey`,
        value: dkimTxt ?? '<run dns endpoint after opendkim has the key>',
        description:
          'DKIM public key (selector publishes the public part, private stays on the server)',
      },
      {
        type: 'TXT',
        name: '_dmarc',
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc_reports@${domain}; ruf=mailto:dmarc_reports@${domain}; fo=1`,
        description:
          'DMARC policy (quarantine on alignment failures, send reports to dmarc_reports@<domain>)',
      },
    ];
    return records;
  }
}
