import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { In, IsNull, MoreThan, Not, Repository } from "typeorm";
import { PaginationQuery, resolveSortColumn } from "../../common/pagination.validation";
import { Account } from "../../entities/account.entity";
import { AccountProfile } from "../../entities/account-profile.entity";
import { GroupMember } from "../../entities/group-member.entity";
import { Group } from "../../entities/group.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { GeocodingService } from "../../geocoding/geocoding.service";
import { UpdateProfileDto } from "./jwt.validation";

// Columns the session-history list may sort by, mapped to their real SQL
// expressions (never interpolate the raw request value -- see resolveSortColumn).
export const SESSIONS_SORTABLE_COLUMNS = ["createdAt", "expiresAt", "revokedAt"] as const;
const SESSIONS_SORT_EXPR: Record<(typeof SESSIONS_SORTABLE_COLUMNS)[number], string> = {
  createdAt: "t.created_at",
  expiresAt: "t.expires_at",
  revokedAt: "t.revoked_at",
};

export type ProfileResponse = {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  addressLine: string | null;
  addressComplement: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  isRoot: boolean;
  groups: { id: string; name: string }[];
};

const ACCESS_TTL = Number(process.env.MANAGER_JWT_ACCESS_TTL ?? 900);
const REFRESH_TTL = Number(process.env.MANAGER_JWT_REFRESH_TTL ?? 2_592_000);

@Injectable()
export class JwtAuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly geocoding: GeocodingService
  ) {}

  // Login identity is the email now (no username).
  async login(email: string, password: string, ua?: string, ip?: string) {
    const account = await this.accounts.findOne({
      where: { email, enabled: 1 },
    });
    if (!account || !account.password) throw new UnauthorizedException("Invalid credentials");
    if (!(await bcrypt.compare(password, account.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    account.lastLogin = new Date();
    await this.accounts.save(account);
    // One live session per device: a re-login from the same device (same UA +
    // IP) revokes that device's earlier still-valid tokens first. Without this
    // every sign-in stacked another active token, so the list showed many
    // "active" rows for a single machine and revoking one left the device
    // logged in through the others. Now the active list mirrors real devices
    // and revoking a session genuinely logs that device out.
    await this.revokeDeviceSessions(account.id, ua, ip);
    return this.issueTokens(account, ua, ip);
  }

  // Revoke every still-live token for one device fingerprint. Skipped when no
  // fingerprint is available (both null), since it could not target a device
  // without also hitting unrelated sign-ins.
  private async revokeDeviceSessions(accountId: string, ua?: string, ip?: string) {
    if (!ua && !ip) return;
    await this.refreshTokens.update(
      { accountId, userAgent: ua ?? IsNull(), ip: ip ?? IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() }
    );
  }

  async refresh(rawToken: string, ua?: string, ip?: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
      relations: ["account"],
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid");
    }
    // Rotate the secret IN PLACE on the same row: a session is one row for its
    // whole life. The previous design revoked this row and inserted a new one on
    // every refresh (i.e. on every tab focus), so a single device piled up an
    // unbounded trail of rows. Rotating in place keeps exactly one row per
    // session -- refreshing never mints a new "active" session -- slides the
    // expiry (a session in use never dies), and updates the device fingerprint,
    // while `createdAt` keeps the original sign-in time. The old secret is
    // overwritten, so a leaked previous token stops working immediately.
    const refreshRaw = randomBytes(48).toString("base64url");
    stored.tokenHash = this.hash(refreshRaw);
    stored.expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
    if (ua !== undefined) stored.userAgent = ua ?? null;
    if (ip !== undefined) stored.ip = ip ?? null;
    await this.refreshTokens.save(stored);
    return {
      accessToken: await this.signAccessToken(stored.account, stored.id),
      refreshToken: refreshRaw,
      expiresAt: stored.expiresAt.toISOString(),
    };
  }

  async revoke(rawToken: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
  }

  async me(accountId: string): Promise<ProfileResponse> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException("Account not found");
    return this.toProfile(account);
  }

  // The caller's currently-live sessions: refresh tokens that are neither revoked
  // nor past expiry, newest first. These are the sign-ins still usable to mint an
  // access token, so this is a small set (one per device). Revoked/expired
  // sign-ins live in the paginated history below. The token hash never leaves.
  async listActiveSessions(accountId: string) {
    const rows = await this.refreshTokens.find({
      where: { accountId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => this.toSessionDto(r, true));
  }

  // The caller's inactive sessions (revoked OR expired), paginated + searchable
  // like every other list in the app: this set grows over time (each refresh
  // rotates a token, revoking the old one), so it must never be returned whole.
  // Search matches user agent or IP.
  async listSessionHistory(accountId: string, query: PaginationQuery) {
    const now = new Date();
    const qb = this.refreshTokens
      .createQueryBuilder("t")
      .where("t.account_id = :accountId", { accountId })
      .andWhere("(t.revoked_at IS NOT NULL OR t.expires_at <= :now)", { now });
    if (query.search) {
      qb.andWhere("(t.user_agent LIKE :s OR t.ip LIKE :s)", { s: `%${query.search}%` });
    }
    const sortBy = resolveSortColumn(query.sortBy, SESSIONS_SORTABLE_COLUMNS, "createdAt");
    qb.orderBy(SESSIONS_SORT_EXPR[sortBy], query.sortDir === "asc" ? "ASC" : "DESC")
      .skip(query.offset)
      .take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((r) => this.toSessionDto(r, false)), total };
  }

  private toSessionDto(r: RefreshToken, active: boolean) {
    // "online now": an active session touched within the last minute is currently
    // in use by someone, as opposed to merely valid but idle. The guard refreshes
    // last_seen_at on each request (throttled), so 60s gives ~1 minute precision.
    const online = active && !!r.lastSeenAt && Date.now() - new Date(r.lastSeenAt).getTime() <= 60_000;
    return {
      id: r.id,
      userAgent: r.userAgent,
      ip: r.ip,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      lastSeenAt: r.lastSeenAt,
      active,
      online,
    };
  }

  // Revoke one of the caller's own sessions. Scoped by accountId so a caller can
  // never revoke another account's session by guessing an id. Idempotent: an
  // already-revoked session is left as-is. A missing id (or one owned by someone
  // else) is a 404, not a silent success.
  async revokeSession(accountId: string, id: number) {
    const stored = await this.refreshTokens.findOne({ where: { id, accountId } });
    if (!stored) throw new NotFoundException("Session not found");
    if (!stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
    return { ok: true };
  }

  // Admin overview: one row per account that has any session, with its active
  // and expired/revoked counts and whether an active session is online now
  // (an active session seen within the last minute). Feeds the grouped-by-account
  // sessions page; drilling into an account uses listActiveSessions /
  // listSessionHistory below, which are already scoped by accountId.
  async listSessionsOverview() {
    const now = new Date();
    const raw = await this.refreshTokens
      .createQueryBuilder("t")
      .select("t.account_id", "accountId")
      .addSelect("SUM(CASE WHEN t.revoked_at IS NULL AND t.expires_at > :now THEN 1 ELSE 0 END)", "activeCount")
      .addSelect("SUM(CASE WHEN t.revoked_at IS NOT NULL OR t.expires_at <= :now THEN 1 ELSE 0 END)", "expiredCount")
      .addSelect("MAX(CASE WHEN t.revoked_at IS NULL AND t.expires_at > :now THEN t.last_seen_at END)", "lastActiveSeenAt")
      .setParameter("now", now)
      .groupBy("t.account_id")
      .getRawMany<{ accountId: string; activeCount: string; expiredCount: string; lastActiveSeenAt: string | null }>();

    const accountIds = raw.map((r) => r.accountId);
    if (!accountIds.length) return [];
    const [accountRows, profileRows] = await Promise.all([
      this.accounts.findBy({ id: In(accountIds) }),
      this.profiles.find({ where: { accountId: In(accountIds) } }),
    ]);
    const emailById = new Map(accountRows.map((a) => [a.id, a.email]));
    const nameById = new Map(profileRows.map((p) => [p.accountId, p.displayName]));

    return raw
      .map((r) => ({
        accountId: r.accountId,
        email: emailById.get(r.accountId) ?? null,
        displayName: nameById.get(r.accountId) ?? null,
        activeCount: Number(r.activeCount),
        expiredCount: Number(r.expiredCount),
        online: !!r.lastActiveSeenAt && now.getTime() - new Date(r.lastActiveSeenAt).getTime() <= 60_000,
      }))
      .sort((a, b) => b.activeCount - a.activeCount || b.expiredCount - a.expiredCount);
  }

  // Admin "kick all": revoke every still-live session of one account in a single
  // call. The auth guard rejects each revoked session's access token on its next
  // request (the sid claim), so the account is signed out everywhere at once.
  async revokeAllActiveSessions(accountId: string) {
    const res = await this.refreshTokens.update(
      { accountId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      { revokedAt: new Date() }
    );
    return { ok: true, revoked: res.affected ?? 0 };
  }

  async updateProfile(accountId: string, input: UpdateProfileDto): Promise<ProfileResponse> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException("Account not found");

    // email lives on `accounts` (the login identity); everything else is a
    // profile attribute.
    if (input.email !== undefined && input.email !== account.email) {
      const clash = await this.accounts.findOne({ where: { email: input.email, id: Not(accountId) } });
      if (clash) throw new ConflictException(`Email ${input.email} is already used by another account`);
      account.email = input.email;
      await this.accounts.save(account);
    }

    const profile = (await this.profiles.findOne({ where: { accountId } })) ?? this.profiles.create({ accountId });
    if (input.displayName !== undefined) profile.displayName = input.displayName;
    if (input.avatarUrl !== undefined) profile.avatarUrl = input.avatarUrl;
    if (input.phone !== undefined) profile.phone = input.phone;
    if (input.addressLine !== undefined) profile.addressLine = input.addressLine;
    if (input.addressComplement !== undefined) profile.addressComplement = input.addressComplement;
    if (input.postalCode !== undefined) profile.postalCode = input.postalCode;
    if (input.country !== undefined) profile.country = input.country;
    if (input.city !== undefined) profile.city = input.city;

    // Whenever the city (or country) is touched, refresh the coordinates: a set
    // city gets geocoded (best-effort; null coords if it fails), a cleared city
    // clears them. Kept in the same save so a profile never carries stale coords.
    if (input.city !== undefined || input.country !== undefined) {
      if (profile.city) {
        const coords = await this.geocoding.geocodeCity(profile.city, profile.country);
        profile.latitude = coords?.latitude ?? null;
        profile.longitude = coords?.longitude ?? null;
      } else {
        profile.latitude = null;
        profile.longitude = null;
      }
    }
    await this.profiles.save(profile);

    return this.toProfile(account);
  }

  private async toProfile(account: Account): Promise<ProfileResponse> {
    const [profile, memberRows] = await Promise.all([
      this.profiles.findOne({ where: { accountId: account.id } }),
      this.groupMembers.find({ where: { accountId: account.id } }),
    ]);
    const groupIds = memberRows.map((m) => m.groupId);
    const groupRows = groupIds.length ? await this.groups.findBy({ id: In(groupIds) }) : [];
    return {
      email: account.email,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      phone: profile?.phone ?? null,
      addressLine: profile?.addressLine ?? null,
      addressComplement: profile?.addressComplement ?? null,
      city: profile?.city ?? null,
      postalCode: profile?.postalCode ?? null,
      country: profile?.country ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      isRoot: account.isRoot === 1,
      groups: groupRows.map((g) => ({ id: g.id, name: g.name })),
    };
  }

  // `sid` is the session (refresh token) row id. It rides in the access token so
  // the auth guard can reject the token the instant that session is revoked,
  // instead of letting it live out its 15-minute expiry. The session row id is
  // stable for a session's whole life (refresh rotates the secret in place).
  private signAccessToken(account: Account, sid: number) {
    return this.jwt.signAsync(
      { sub: account.id, email: account.email, isRoot: account.isRoot === 1, sid },
      { secret: process.env.MANAGER_JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL }
    );
  }

  // Login only: opens a brand-new session row. Refresh never calls this (it
  // rotates the existing row), so a session is one row from sign-in to sign-out.
  private async issueTokens(account: Account, userAgent?: string, ip?: string) {
    const refreshRaw = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
    // Insert first so the row id (the session id) can go into the access token.
    const inserted = await this.refreshTokens.insert({
      accountId: account.id,
      tokenHash: this.hash(refreshRaw),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      expiresAt,
      createdAt: new Date(),
    });
    const sid = inserted.identifiers[0]?.id as number;
    return {
      accessToken: await this.signAccessToken(account, sid),
      refreshToken: refreshRaw,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private hash(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }
}
