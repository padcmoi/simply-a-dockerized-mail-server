import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import type { PaginationQuery } from "../../../core/common/pagination.validation";
import { SieveRejectSender } from "../../../core/entities/sieve-reject-sender.entity";

@Injectable()
export class RejectSendersService {
  constructor(
    @InjectRepository(SieveRejectSender)
    private readonly repo: Repository<SieveRejectSender>
  ) {}

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // dashboard.vue's blocked-senders stat card (needs the full count/list).
  async list(query: PaginationQuery) {
    if (query.limit === undefined) {
      return this.repo.find({ order: { sender: "ASC" } });
    }
    const where = query.search ? { sender: Like(`%${query.search}%`) } : {};
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { items, total };
  }

  async create(sender: string) {
    if (await this.repo.findOne({ where: { sender } })) {
      throw new ConflictException(`Sender ${sender} already blocked`);
    }
    return this.repo.save(this.repo.create({ sender, enabled: 1, createdAt: new Date(), updatedAt: new Date() }));
  }

  async toggle(id: number, enabled: boolean) {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException();
    current.enabled = enabled ? 1 : 0;
    return this.repo.save(current);
  }

  async remove(id: number) {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException();
    await this.repo.remove(current);
    return { ok: true };
  }
}
