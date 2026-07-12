import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { In, Not, Repository } from "typeorm";
import { Account } from "../../entities/account.entity";
import { AccountProfile } from "../../entities/account-profile.entity";
import { GroupMember } from "../../entities/group-member.entity";
import { Group } from "../../entities/group.entity";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { GeocodingService } from "../../geocoding/geocoding.service";
import { UpdateProfileDto } from "./jwt.validation";

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
    return this.issueTokens(account, ua, ip);
  }

  async refresh(rawToken: string, ua?: string, ip?: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
      relations: ["account"],
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid");
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(stored.account, ua, ip);
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

  private async issueTokens(account: Account, userAgent?: string, ip?: string) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: account.id,
        email: account.email,
        isRoot: account.isRoot === 1,
      },
      { secret: process.env.MANAGER_JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL }
    );
    const refreshRaw = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
    await this.refreshTokens.insert({
      accountId: account.id,
      tokenHash: this.hash(refreshRaw),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      expiresAt,
      createdAt: new Date(),
    });
    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private hash(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }
}
