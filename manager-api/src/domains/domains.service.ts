import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateDomainDto, UpdateDomainDto } from './domains.validation'
import { VirtualDomain } from './virtual-domain.entity'

@Injectable()
export class DomainsService {
  constructor(@InjectRepository(VirtualDomain) private readonly repo: Repository<VirtualDomain>) {}

  list() {
    return this.repo.find({ order: { domain: 'ASC' } })
  }

  async get(id: number) {
    const found = await this.repo.findOne({ where: { id } })
    if (!found) throw new NotFoundException(`Domain #${id} not found`)
    return found
  }

  async create(input: CreateDomainDto) {
    if (await this.repo.findOne({ where: { domain: input.domain } })) {
      throw new ConflictException(`Domain ${input.domain} already exists`)
    }
    return this.repo.save(this.repo.create({
      domain: input.domain,
      quota: String(input.quota ?? 0),
      active: input.active ? 1 : 0,
      ownerId: input.ownerId ?? null,
      userStartDate: new Date().toISOString().slice(0, 10),
      userEndDate: input.userEndDate ?? null,
    }))
  }

  async update(id: number, input: UpdateDomainDto) {
    const current = await this.get(id)
    if (input.domain !== undefined) current.domain = input.domain
    if (input.quota !== undefined) current.quota = String(input.quota)
    if (input.active !== undefined) current.active = input.active ? 1 : 0
    if (input.ownerId !== undefined) current.ownerId = input.ownerId
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate
    return this.repo.save(current)
  }

  async remove(id: number) {
    await this.repo.remove(await this.get(id))
    return { ok: true }
  }
}
