import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Repository } from "typeorm";
import { ApiToken } from "./api-token.entity";
import { decryptSecret, encryptSecret } from "./api-token.cipher";
import { KEY_PREFIX, normalizeIp, parseApiKey } from "./api-token.request";
import { parseScopes, refuseScopesBeyondAccount, serialiseScopes, type TokenScopes } from "./api-token.scopes";
import { CustomPermissionGuardService } from "../../custom-permission-guard/custom-permission-guard.service";
import type { CreateApiTokenDto, UpdateApiTokenDto } from "./api-token.validation";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class ApiTokenService {
  constructor(
    @InjectRepository(ApiToken) private readonly repo: Repository<ApiToken>,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  private get pepper(): string {
    const p = process.env.MANAGER_API_TOKEN_PEPPER;
    if (!p) throw new Error("MANAGER_API_TOKEN_PEPPER env var is required");
    return p;
  }

  private hashSecret(raw: string): string {
    return createHmac("sha256", this.pepper).update(raw).digest("hex");
  }

  private verifySecret(raw: string, storedHex: string): boolean {
    const computed = Buffer.from(this.hashSecret(raw), "hex");
    const stored = Buffer.from(storedHex, "hex");
    if (computed.byteLength !== stored.byteLength) {
      timingSafeEqual(computed, computed);
      return false;
    }
    return timingSafeEqual(computed, stored);
  }

  private toSafe(t: ApiToken) {
    return {
      id: t.id,
      name: t.name,
      clientId: t.clientId,
      allowedIps: t.allowedIps ? (JSON.parse(t.allowedIps) satisfies string[]) : null,
      // Null is not "no rights": it is a key that was never narrowed.
      scopes: parseScopes(t.scopes),
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      lastUsedAt: t.lastUsedAt,
      lastUsedIp: t.lastUsedIp,
      createdAt: t.createdAt,
      secretAvailable: t.secretCipher.length > 0,
    };
  }

  // Nothing may be put in a scope that its author does not hold, or a key would
  // be a way to mint rights instead of a way to narrow them.
  private async assertScopesWithinAccount(accountId: string, isRoot: boolean, scopes: CreateApiTokenDto["scopes"]) {
    if (!scopes) return;
    const refused = await refuseScopesBeyondAccount(this.cpg.guard.assertOne, accountId, isRoot, scopes);
    if (refused.length) {
      throw new ForbiddenException(`You do not hold ${refused.join(", ")}, so a key of yours cannot either`);
    }
  }

  async create(accountId: string, isRoot: boolean, input: CreateApiTokenDto) {
    await this.assertScopesWithinAccount(accountId, isRoot, input.scopes);
    const clientId = randomBytes(16).toString("base64url");
    const rawSecret = randomBytes(32).toString("base64url");

    const token = this.repo.create({
      accountId,
      name: input.name,
      clientId,
      secretHash: this.hashSecret(rawSecret),
      secretCipher: encryptSecret(rawSecret, this.pepper),
      allowedIps: input.allowedIps?.length ? JSON.stringify(input.allowedIps) : null,
      scopes: serialiseScopes(input.scopes),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    try {
      const saved = await this.repo.save(token);
      return {
        id: saved.id,
        name: saved.name,
        clientId,
        key: `${KEY_PREFIX}${clientId}.${rawSecret}`,
        allowedIps: input.allowedIps ?? null,
        scopes: parseScopes(saved.scopes),
        expiresAt: saved.expiresAt,
        createdAt: saved.createdAt,
      };
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ConflictException("A token with this name already exists");
      throw e;
    }
  }

  async list(accountId: string) {
    const tokens = await this.repo.find({ where: { accountId }, order: { createdAt: "DESC" } });
    return tokens.map((t) => this.toSafe(t));
  }

  async update(accountId: string, isRoot: boolean, id: number, input: UpdateApiTokenDto) {
    const token = await this.repo.findOne({ where: { id, accountId } });
    if (!token) throw new NotFoundException("Token not found");
    await this.assertScopesWithinAccount(accountId, isRoot, input.scopes);
    if (input.name !== undefined) token.name = input.name;
    if (input.allowedIps !== undefined) {
      token.allowedIps = input.allowedIps?.length ? JSON.stringify(input.allowedIps) : null;
    }
    if ("scopes" in input) token.scopes = serialiseScopes(input.scopes);
    if ("expiresAt" in input) token.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    try {
      await this.repo.save(token);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ConflictException("A token with this name already exists");
      throw e;
    }
    return this.toSafe(token);
  }

  async reveal(accountId: string, id: number) {
    const token = await this.repo.findOne({ where: { id, accountId } });
    if (!token) throw new NotFoundException("Token not found");
    if (!token.secretCipher) return { id: token.id, name: token.name, clientId: token.clientId, key: null };

    const secret = decryptSecret(token.secretCipher, this.pepper);
    return {
      id: token.id,
      name: token.name,
      clientId: token.clientId,
      key: secret === null ? null : `${KEY_PREFIX}${token.clientId}.${secret}`,
    };
  }

  async revoke(accountId: string, id: number) {
    const token = await this.repo.findOne({ where: { id, accountId } });
    if (!token) throw new NotFoundException("Token not found");
    if (token.revokedAt) throw new BadRequestException("Token is already revoked");
    token.revokedAt = new Date();
    await this.repo.save(token);
    return this.toSafe(token);
  }

  async delete(accountId: string, id: number) {
    const token = await this.repo.findOne({ where: { id, accountId } });
    if (!token) throw new NotFoundException("Token not found");
    if (!token.revokedAt) throw new BadRequestException("Token must be revoked before deletion");
    await this.repo.delete(id);
  }

  async regenerate(accountId: string, id: number) {
    const token = await this.repo.findOne({ where: { id, accountId } });
    if (!token) throw new NotFoundException("Token not found");
    if (token.revokedAt) throw new BadRequestException("Cannot regenerate a revoked token");
    const rawSecret = randomBytes(32).toString("base64url");
    token.secretHash = this.hashSecret(rawSecret);
    token.secretCipher = encryptSecret(rawSecret, this.pepper);
    token.failedAttempts = 0;
    token.lockedUntil = null;
    await this.repo.save(token);
    return {
      id: token.id,
      name: token.name,
      clientId: token.clientId,
      key: `${KEY_PREFIX}${token.clientId}.${rawSecret}`,
      allowedIps: token.allowedIps ? (JSON.parse(token.allowedIps) satisfies string[]) : null,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    };
  }

  async validate(
    rawKey: string,
    requestIp: string
  ): Promise<{ id: string; email: string; isRoot: boolean; scopes: TokenScopes | null } | null> {
    const parsed = parseApiKey(rawKey);
    if (!parsed) return null;

    const { clientId, secret: rawSecret } = parsed;

    const token = await this.repo.findOne({ where: { clientId }, relations: ["account"] });
    if (!token) return null;

    if (token.lockedUntil && token.lockedUntil > new Date()) return null;
    if (token.expiresAt && token.expiresAt < new Date()) return null;
    if (token.revokedAt) return null;

    if (!this.verifySecret(rawSecret, token.secretHash)) {
      token.failedAttempts += 1;
      if (token.failedAttempts >= MAX_FAILED) {
        token.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        token.failedAttempts = 0;
      }
      await this.repo.save(token);
      return null;
    }

    const ip = normalizeIp(requestIp);
    if (token.allowedIps) {
      const allowed = JSON.parse(token.allowedIps) satisfies string[];
      if (allowed.length > 0 && !allowed.includes(ip)) return null;
    }

    if (!token.account.enabled) return null;

    token.failedAttempts = 0;
    token.lockedUntil = null;
    token.lastUsedAt = new Date();
    token.lastUsedIp = ip;
    await this.repo.save(token);

    return {
      id: token.account.id,
      email: token.account.email,
      isRoot: token.account.isRoot === 1,
      // The key's own ceiling, carried to the auth guard: the permission guards
      // resolve the account's rights and know nothing of keys, so the narrowing
      // is applied before them.
      scopes: parseScopes(token.scopes),
    };
  }
}
