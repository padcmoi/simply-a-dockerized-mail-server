import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SieveRejectSender } from './sieve-reject-sender.entity'

@Injectable()
export class SieveService {
  constructor(@InjectRepository(SieveRejectSender) private readonly repo: Repository<SieveRejectSender>) {}

  list() {
    return this.repo.find({ order: { sender: 'ASC' } })
  }

  async create(sender: string) {
    if (await this.repo.findOne({ where: { sender } })) {
      throw new ConflictException(`Sender ${sender} already blocked`)
    }
    return this.repo.save(this.repo.create({ sender, enabled: 1, dateCreation: new Date() }))
  }

  async toggle(id: number, enabled: boolean) {
    const current = await this.repo.findOne({ where: { id } })
    if (!current) throw new NotFoundException()
    current.enabled = enabled ? 1 : 0
    return this.repo.save(current)
  }

  async remove(id: number) {
    const current = await this.repo.findOne({ where: { id } })
    if (!current) throw new NotFoundException()
    await this.repo.remove(current)
    return { ok: true }
  }
}
