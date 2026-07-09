import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../entities/audit-log.entity";

export interface RecordAuditLogInput {
  actorId: string | null;
  action: string;
  entityType: string;
  // Polymorphic: a uuid for a group, a stringified int for a domain.
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

// Append-only trail for every ACL-relevant mutation (permission changes,
// owner/default-group transfers, group deletion...). Kept intentionally
// dumb -- a single insert, no reads -- per security-hardening.md.
@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.repo.insert({
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
      beforeJson: input.before !== undefined ? JSON.stringify(input.before) : null,
      afterJson: input.after !== undefined ? JSON.stringify(input.after) : null,
    });
  }
}
