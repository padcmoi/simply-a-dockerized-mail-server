import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomInt } from "crypto";
import { Repository } from "typeorm";
import { ApiError } from "../../common/api-error";
import { Account } from "../../entities/account.entity";
import { ActivityLogService } from "../../activity/activity-log.service";
import { MailerService } from "../../mailer/mailer.service";
import { AppSettingsService } from "../../settings/app-settings.service";
import { FarAway } from "./login-risk.service";
import { MfaChallengeStore, MfaMethod } from "./mfa-challenge.store";
import { MfaService } from "./mfa.service";

const CODE_TTL_MINUTES = 10;

/** What answered the distance, as the journal records it. */
type FarAwayProof = MfaMethod | "two-factor" | "none";

export interface MfaRequired {
  mfaRequired: true;
  method: MfaMethod;
  challenge: string;
  expiresAt: string;
  /** Only for `email`: the address the code went to, masked. */
  hint?: string;
  /** Only for `question`: what to answer. */
  question?: string;
  /**
   * The other proof this same challenge could switch to, when there is one: a
   * mailbox that cannot be read right now is answered by the question, and a
   * question whose answer escapes its owner by the code. Absent when the other
   * cannot be offered at all -- no mail configured, no question chosen.
   */
  alternative?: MfaMethod;
}

// "julien@gestionpratique.ovh" -> "j***@gestionpratique.ovh". Enough for the
// owner to recognise their own mailbox, not enough for a stranger holding the
// password to learn an address they did not already have.
function maskEmail(email: string) {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

@Injectable()
export class MfaLoginService {
  private readonly log = new Logger(MfaLoginService.name);

  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly mfa: MfaService,
    private readonly challenges: MfaChallengeStore,
    private readonly mailer: MailerService,
    private readonly activity: ActivityLogService,
    private readonly appSettings: AppSettingsService
  ) {}

  // A sign-in from too far away, on the record whatever comes of it: what was
  // asked of it, or that nothing could be. An account with the authenticator
  // app is never asked twice -- its code already answers the distance -- so the
  // journal is the only trace the far-away sign-in leaves there.
  private note(account: Account, far: FarAway, method: FarAwayProof) {
    return this.activity.record({
      action: "auth.login.far",
      actorId: account.id,
      details: { distanceKm: far.distanceKm, thresholdKm: far.thresholdKm, method },
    });
  }

  noteTwoFactor(account: Account, far: FarAway) {
    return this.note(account, far, "two-factor");
  }

  // What to ask of a sign-in that came from too far away, in the order the
  // server was told to prefer, skipping whatever cannot be offered: no mail
  // configured or a send that fails, no question chosen. Null when neither can
  // be asked -- the session then opens, because refusing would lock the owner
  // of a server that has no mail configured out of their own manager, and the
  // event is on record either way.
  async open(account: Account, far: FarAway): Promise<MfaRequired | null> {
    for (const method of this.appSettings.get().loginChallengeOrder.split(",") as MfaMethod[]) {
      const asked = method === "email" ? await this.askByMail(account, far) : await this.askTheQuestion(account);
      if (asked) {
        await this.note(account, far, method);
        return { ...asked, alternative: (await this.otherWay(account.id, method)) ?? undefined };
      }
    }

    await this.note(account, far, "none");
    this.log.warn(`Account ${account.id} signed in from ${far.distanceKm} km away with nothing to prove it with`);
    return null;
  }

  private async askByMail(account: Account, far: FarAway): Promise<MfaRequired | null> {
    if (!(await this.mailer.isEnabled())) return null;
    const code = sixDigits();
    const { challenge, expiresAt } = this.challenges.mint(account.id, "email", code);
    try {
      await this.mailer.sendLoginCode({
        to: account.email,
        code,
        distanceKm: far.distanceKm,
        minutes: CODE_TTL_MINUTES,
      });
      return {
        mfaRequired: true,
        method: "email",
        challenge,
        expiresAt: expiresAt.toISOString(),
        hint: maskEmail(account.email),
      };
    } catch (e) {
      this.challenges.settle(challenge);
      this.log.warn(`Sign-in code could not be sent to ${maskEmail(account.email)}: ${(e as Error).message}`);
      return null;
    }
  }

  private async askTheQuestion(account: Account): Promise<MfaRequired | null> {
    const question = await this.mfa.questionOf(account.id);
    if (!question) return null;
    const { challenge, expiresAt } = this.challenges.mint(account.id, "question");
    return { mfaRequired: true, method: "question", challenge, expiresAt: expiresAt.toISOString(), question };
  }

  // Whether the proof this challenge is not using could be offered instead:
  // mail only where mail is configured, the question only where one has been
  // chosen. Null when there is no other way, and the browser then offers none.
  private async otherWay(accountId: string, current: MfaMethod): Promise<MfaMethod | null> {
    if (current === "email") return (await this.mfa.questionOf(accountId)) ? "question" : null;
    return (await this.mailer.isEnabled()) ? "email" : null;
  }

  // The same challenge, proved the other way. The identifier, the deadline and
  // the tries already spent are the ones it had: switching swaps the proof, it
  // never buys a fresh set of guesses. Asking for the method it already uses is
  // a resend of the code, or the question said again.
  async switchTo(challenge: string, method: MfaMethod): Promise<MfaRequired> {
    const entry = this.challenges.peek(challenge);
    if (!entry) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "mfa.challengeExpired", "Start the sign-in again");
    }
    const account = await this.accounts.findOne({ where: { id: entry.accountId } });
    if (!account) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "mfa.challengeExpired", "Start the sign-in again");
    }

    const expiresAt = new Date(entry.expiresAt).toISOString();

    if (method === "question") {
      const question = await this.mfa.questionOf(account.id);
      if (!question) {
        throw new ApiError(HttpStatus.CONFLICT, "mfa.methodUnavailable", "This account has no security question");
      }
      this.challenges.switchTo(challenge, "question");
      return {
        mfaRequired: true,
        method: "question",
        challenge,
        expiresAt,
        question,
        alternative: (await this.otherWay(account.id, "question")) ?? undefined,
      };
    }

    if (!(await this.mailer.isEnabled())) {
      throw new ApiError(HttpStatus.CONFLICT, "mfa.methodUnavailable", "This server cannot send mail");
    }
    // The wait every other mail obeys, but only once one has actually gone out:
    // a challenge that started as a question has sent nothing and waits for
    // nobody.
    const waitMs = entry.mailSentAt === null ? 0 : this.appSettings.get().mailMinIntervalMs - (Date.now() - entry.mailSentAt);
    if (waitMs > 0) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "mfa.resendTooSoon", "A code has just been sent", { waitMs });
    }
    const code = sixDigits();
    await this.mailer.sendLoginCode({ to: account.email, code, minutes: CODE_TTL_MINUTES });
    this.challenges.switchTo(challenge, "email", code);
    return {
      mfaRequired: true,
      method: "email",
      challenge,
      expiresAt,
      hint: maskEmail(account.email),
      alternative: (await this.otherWay(account.id, "email")) ?? undefined,
    };
  }

  // The account behind a challenge whose answer is right. An unknown, expired
  // or exhausted challenge is one answer, so a guess learns nothing about
  // which; a wrong answer is another, and the challenge survives it.
  async verify(challenge: string, answer: string): Promise<string> {
    const entry = this.challenges.attempt(challenge);
    if (!entry) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "mfa.challengeExpired", "Start the sign-in again");
    }
    const accepted =
      entry.method === "email"
        ? this.challenges.matches(challenge, answer)
        : await this.mfa.verifyAnswer(entry.accountId, answer);
    if (!accepted) {
      await this.activity.record({ action: "auth.mfa.refused", actorId: entry.accountId });
      const code = entry.method === "email" ? "mfa.invalidCode" : "mfa.invalidAnswer";
      throw new ApiError(HttpStatus.BAD_REQUEST, code, "This is not the answer expected");
    }
    this.challenges.settle(challenge);
    return entry.accountId;
  }

  // A second code for the same challenge. The previous one stops working, and
  // the wait between two sends is the one every other mail obeys.
  async resend(challenge: string) {
    const entry = this.challenges.peek(challenge);
    if (!entry || entry.method !== "email") {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "mfa.challengeExpired", "Start the sign-in again");
    }
    const waitMs = this.appSettings.get().mailMinIntervalMs - (Date.now() - (entry.mailSentAt ?? 0));
    if (waitMs > 0) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "mfa.resendTooSoon", "A code has just been sent", { waitMs });
    }
    const account = await this.accounts.findOne({ where: { id: entry.accountId } });
    if (!account) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "mfa.challengeExpired", "Start the sign-in again");
    }
    const code = sixDigits();
    this.challenges.replaceCode(challenge, code);
    await this.mailer.sendLoginCode({ to: account.email, code, minutes: CODE_TTL_MINUTES });
    return { sent: true, hint: maskEmail(account.email) };
  }
}
