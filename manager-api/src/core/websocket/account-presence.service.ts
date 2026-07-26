import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccountProfile } from "../entities/account-profile.entity";

// Owns `account_profiles.presence`: the one place that answers "who is online", for any
// consumer and any number of accounts. Presence is not a session: a session
// grants access, presence says someone is actually there right now.
@Injectable()
export class AccountPresenceService implements OnModuleInit {
  constructor(@InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>) {}

  // Sockets do not survive a restart, so nobody is online at boot: leaving the
  // previous run's rows behind would show ghosts as connected forever.
  async onModuleInit() {
    await this.profiles.update({ presence: 1 }, { presence: 0, offlineNotifiedAt: new Date() }).catch(() => undefined);
  }

  // Upsert rather than update: an account whose profile row was never created
  // must still be able to report itself online.
  async setStatus(accountId: string, online: boolean) {
    await this.profiles.upsert({ accountId, presence: online ? 1 : 0, presenceAt: new Date() }, ["accountId"]);
  }

  async onlineAccountIds(): Promise<string[]> {
    const rows = await this.profiles.find({ where: { presence: 1 }, select: { accountId: true } });
    return rows.map((r) => r.accountId);
  }

  // What the presence topic serves: who is online, plus when the others were
  // last there. Only offline accounts carry a timestamp, since it is the only
  // case a reader needs it.
  async presenceState() {
    const rows = await this.profiles.find({ select: { accountId: true, presence: true, presenceAt: true } });
    const online: string[] = [];
    const lastSeen: Record<string, string> = {};
    for (const row of rows) {
      if (row.presence === 1) online.push(row.accountId);
      else if (row.presenceAt) lastSeen[row.accountId] = row.presenceAt.toISOString();
    }
    return { online, lastSeen };
  }

  async isOnline(accountId: string): Promise<boolean> {
    const row = await this.profiles.findOne({ where: { accountId }, select: { presence: true } });
    return row?.presence === 1;
  }
}
