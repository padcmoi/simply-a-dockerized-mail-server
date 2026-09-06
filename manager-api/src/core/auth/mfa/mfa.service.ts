import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ApiError } from "../../common/api-error";
import { GeoPoint } from "../../common/haversine";
import { AccountMfa } from "../../entities/account-mfa.entity";
import { ActivityLogService } from "../../activity/activity-log.service";
import { hashAnswer, matchAnswer } from "./security-answer";
import { SECURITY_QUESTIONS, SecurityQuestion, isSecurityQuestion } from "./security-questions";

// Consecutive wrong answers before the question stops being checked for a
// while. The login challenge has its own five tries; this covers the
// authenticated route, where a stolen session could walk a first name.
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60_000;

export interface SecurityQuestionStatus {
  set: boolean;
  question: SecurityQuestion | null;
  /** The questions on offer, so the interface never carries a list of its own. */
  catalogue: readonly SecurityQuestion[];
}

@Injectable()
export class MfaService {
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(
    @InjectRepository(AccountMfa) private readonly rows: Repository<AccountMfa>,
    private readonly activity: ActivityLogService
  ) {}

  private pepper() {
    const p = process.env.MANAGER_API_TOKEN_PEPPER;
    if (!p) throw new Error("MANAGER_API_TOKEN_PEPPER env var is required");
    return p;
  }

  // A missing row and an unreachable table answer the same: nothing known. The
  // sign-in guard is never what stops a server from being signed in to, and an
  // image running ahead of its migration must serve sign-ins, not refuse them.
  private rowOf(accountId: string) {
    return this.rows.findOne({ where: { accountId } }).catch(() => null);
  }

  async placeOf(accountId: string): Promise<GeoPoint | null> {
    const row = await this.rowOf(accountId);
    if (!row?.loginLatitude || !row.loginLongitude) return null;
    const latitude = Number(row.loginLatitude);
    const longitude = Number(row.loginLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }

  // Every session that opens moves the point to where it opened, whether it
  // walked straight in or answered a challenge first. The place therefore
  // travels with its owner, and only a jump longer than the radius costs a
  // proof. Best effort: a sign-in must not fail because this could not be
  // written.
  async rememberPlace(accountId: string, place: GeoPoint | null) {
    if (!place) return;
    try {
      const row = (await this.rowOf(accountId)) ?? this.rows.create({ accountId });
      row.loginLatitude = place.latitude.toFixed(7);
      row.loginLongitude = place.longitude.toFixed(7);
      row.loginSeenAt = new Date();
      await this.rows.save(row);
    } catch {
      // The place is a convenience, not a credential.
    }
  }

  async status(accountId: string): Promise<SecurityQuestionStatus> {
    const question = await this.questionOf(accountId);
    return { set: question !== null, question, catalogue: SECURITY_QUESTIONS };
  }

  async hasQuestion(accountId: string) {
    return !!(await this.rowOf(accountId))?.answerHash;
  }

  // Three answers rather than two, because the guard that sends an account off
  // to choose a question must tell "there is none" from "the question cannot be
  // read right now". A table that does not exist yet is the second, and refusing
  // every request over it would lock the whole manager on a single missing
  // migration.
  async questionState(accountId: string): Promise<"set" | "missing" | "unknown"> {
    try {
      const row = await this.rows.findOne({ where: { accountId } });
      return row?.answerHash ? "set" : "missing";
    } catch {
      return "unknown";
    }
  }

  // The key of the question, or null. A row whose question is no longer one the
  // API offers reads as none: the catalogue can lose an entry, and a question
  // nothing can display any more must be chosen again rather than shown blank.
  async questionOf(accountId: string): Promise<SecurityQuestion | null> {
    const row = await this.rowOf(accountId);
    if (!row?.answerHash || !row.question || !isSecurityQuestion(row.question)) return null;
    return row.question;
  }

  // Chosen once and never again. A question that can be replaced from inside a
  // session is no protection at all: whoever walked in with the stolen password
  // would rewrite it before the owner ever knew. There is no route out of this,
  // not even an administrator's: undoing it takes a hand on the database.
  // The accounts of a list that carry a question, in one read: a page of fifty
  // rows asking one by one would be fifty queries for a button.
  async questionSetAmong(accountIds: string[]) {
    if (!accountIds.length) return new Set<string>();
    const rows = await this.rows.find({ where: { accountId: In(accountIds) } }).catch(() => []);
    return new Set(rows.filter((row) => row.answerHash).map((row) => row.accountId));
  }

  async setQuestion(accountId: string, question: SecurityQuestion, answer: string) {
    const existing = await this.rowOf(accountId);
    if (existing?.answerHash) {
      throw new ApiError(HttpStatus.CONFLICT, "securityQuestion.alreadySet", "The security question is already set");
    }
    const row = existing ?? this.rows.create({ accountId });
    row.question = question;
    row.answerHash = hashAnswer(answer, this.pepper());
    await this.rows.save(row);
    await this.activity.record({ action: "auth.security-question.set", actorId: accountId });
    return { set: true, question, catalogue: SECURITY_QUESTIONS };
  }

  // The sign-in's fallback step, and the authenticated route's check. A wrong
  // answer counts against the account, five in a row shut the question for
  // fifteen minutes.
  async verifyAnswer(accountId: string, answer: string) {
    this.assertNotLocked(accountId);
    const row = await this.rowOf(accountId);
    if (!row?.answerHash) return false;
    if (!matchAnswer(answer, row.answerHash, this.pepper())) {
      this.countFailure(accountId);
      return false;
    }
    this.failures.delete(accountId);
    return true;
  }

  // The only way back for someone who no longer remembers their own answer,
  // and it is an administrator's, never the account's own: a question a session
  // could rewrite would protect nothing. The account's usual sign-in place is
  // left alone, and the next sign-in asks for a new question.
  async resetQuestion(accountId: string) {
    const row = await this.rowOf(accountId);
    if (!row?.answerHash) return { reset: false };
    row.question = null;
    row.answerHash = null;
    await this.rows.save(row);
    await this.activity.record({
      action: "auth.security-question.reset",
      subjectId: accountId,
      entity: { type: "account", id: accountId },
    });
    return { reset: true };
  }

  private assertNotLocked(accountId: string) {
    const entry = this.failures.get(accountId);
    if (entry && entry.count >= MAX_FAILURES && entry.until > Date.now()) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        "mfa.tooManyAttempts",
        "Too many wrong answers, try again in a few minutes"
      );
    }
    if (entry && entry.until <= Date.now()) this.failures.delete(accountId);
  }

  private countFailure(accountId: string) {
    const entry = this.failures.get(accountId) ?? { count: 0, until: 0 };
    entry.count += 1;
    entry.until = Date.now() + LOCKOUT_MS;
    this.failures.set(accountId, entry);
  }
}
