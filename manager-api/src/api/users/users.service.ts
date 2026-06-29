import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { sha512crypt } from "../../core/common/sha512-crypt";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { CreateUserDto, UpdateUserDto } from "./users.validation";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(VirtualUser) private readonly repo: Repository<VirtualUser>) {}

  list(domain?: string) {
    return this.repo.find({ where: domain ? { domain } : {}, order: { email: "ASC" } });
  }

  async get(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`User #${id} not found`);
    return found;
  }

  async create(input: CreateUserDto) {
    if (await this.repo.findOne({ where: { email: input.email } })) {
      throw new ConflictException(`User ${input.email} already exists`);
    }
    const [local, domain] = input.email.split("@");
    if (!local || !domain) throw new ConflictException("email must be local@domain");
    return this.repo.save(
      this.repo.create({
        email: input.email,
        domain,
        password: await sha512crypt(input.password),
        maildir: `${domain}/${local}/`,
        quota: String(input.quota ?? 524_288_000),
        active: input.active === false ? 0 : 1,
        uid: "vmail",
        gid: "vmail",
        userStartDate: new Date().toISOString().slice(0, 10),
        userEndDate: input.userEndDate ?? null,
      })
    );
  }

  async update(id: number, input: UpdateUserDto) {
    const current = await this.get(id);
    if (input.password) current.password = await sha512crypt(input.password);
    if (input.quota !== undefined) current.quota = String(input.quota);
    if (input.active !== undefined) current.active = input.active ? 1 : 0;
    if (input.userEndDate !== undefined) current.userEndDate = input.userEndDate;
    return this.repo.save(current);
  }

  async remove(id: number) {
    await this.repo.remove(await this.get(id));
    return { ok: true };
  }
}
