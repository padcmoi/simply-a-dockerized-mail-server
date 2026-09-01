import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { PassportAuthService } from "../../src/core/auth/passport/passport.service";
import { PassportExchangeStore } from "../../src/core/auth/passport/passport-exchange.store";
import type { ProviderRegistryService } from "../../src/core/auth/passport/provider-registry.service";
import type { ProviderIdentity } from "../../src/core/auth/passport/passport-providers";
import type { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { AccountIdentity } from "../../src/core/entities/account-identity.entity";
import type { AccountProfile } from "../../src/core/entities/account-profile.entity";
import type { Group } from "../../src/core/entities/group.entity";
import { cpgMock, entity, providerMock, repoMock, type CpgMock, type Loose } from "../helpers/mocks";

const MANAGER_URL = "https://mgr.test";

function identity(over: Partial<ProviderIdentity> = {}): ProviderIdentity {
  return {
    provider: "google",
    subject: "sub-1",
    email: "alice@example.com",
    emailVerified: true,
    firstName: "Alice",
    lastName: "Martin",
    picture: "https://x/a.png",
    ...over,
  };
}

describe("PassportAuthService", () => {
  let accounts: ReturnType<typeof repoMock<Account>>;
  let identities: ReturnType<typeof repoMock<AccountIdentity>>;
  let profiles: ReturnType<typeof repoMock<AccountProfile>>;
  let groups: ReturnType<typeof repoMock<Group>>;
  let auth: Loose<JwtAuthService>;
  let cpg: CpgMock;
  let settings: Loose<AppSettingsService>;
  let exchange: PassportExchangeStore;
  let registry: Loose<ProviderRegistryService>;
  let svc: PassportAuthService;

  const view = (over: Partial<ReturnType<AppSettingsService["get"]>> = {}) => ({
    ...APP_SETTINGS_DEFAULTS,
    managerUrl: MANAGER_URL,
    ...over,
  });

  beforeEach(() => {
    accounts = repoMock<Account>();
    identities = repoMock<AccountIdentity>();
    profiles = repoMock<AccountProfile>();
    groups = repoMock<Group>();
    auth = providerMock<JwtAuthService>({ openSessionFor: vi.fn() });
    cpg = cpgMock();
    settings = providerMock<AppSettingsService>({ get: vi.fn(() => view()) });
    exchange = new PassportExchangeStore();
    registry = providerMock<ProviderRegistryService>({
      isEnabled: vi.fn(() => true),
      list: vi.fn(() => [{ id: "google", label: "Google", configured: true, enabled: true, clientId: "cid" }]),
    });
    svc = new PassportAuthService(accounts, identities, profiles, groups, auth, cpg, settings, exchange, registry);
  });

  describe("usability", () => {
    it("is usable when the manager URL, the master switch and the provider all say yes", () => {
      expect(svc.isUsable("google")).toBe(true);
    });

    it("is unusable with no manager URL, since no callback can be built", () => {
      settings.get.mockReturnValue(view({ managerUrl: "" }));
      expect(svc.managerUrlSet()).toBe(false);
      expect(svc.isUsable("google")).toBe(false);
    });

    it("is unusable while external sign-in is switched off server-wide", () => {
      settings.get.mockReturnValue(view({ passportEnabled: false }));
      expect(svc.isUsable("google")).toBe(false);
    });

    it("is unusable for a provider this build does not know", () => {
      expect(svc.isUsable("nope")).toBe(false);
    });

    it("is unusable when the registry has no credentials for it", () => {
      registry.isEnabled.mockReturnValue(false);
      expect(svc.isUsable("google")).toBe(false);
    });

    it("lists only usable providers publicly, and never says whether accounts are created", () => {
      expect(svc.publicProviders()).toEqual([{ id: "google", label: "Google" }]);
      registry.isEnabled.mockReturnValue(false);
      expect(svc.publicProviders()).toEqual([]);
    });

    it("hands the administration each provider plus the two URLs its console needs", () => {
      expect(svc.adminProviders()).toEqual([
        {
          id: "google",
          label: "Google",
          configured: true,
          enabled: true,
          clientId: "cid",
          javascriptOrigin: MANAGER_URL,
          redirectUri: `${MANAGER_URL}/api/v1/auth/passport/google/callback`,
        },
      ]);
    });
  });

  describe("urls", () => {
    it("builds the callback from the manager URL, trailing slashes trimmed", () => {
      settings.get.mockReturnValue(view({ managerUrl: `${MANAGER_URL}//` }));
      expect(svc.callbackUrl("google")).toBe(`${MANAGER_URL}/api/v1/auth/passport/google/callback`);
    });

    it("returns to the login screen with a relative path, which needs no configuration", () => {
      expect(svc.loginRedirect({ provider_code: "c" })).toBe("/login?provider_code=c");
    });
  });

  describe("codeForIdentity", () => {
    it("signs in an account already linked by (provider, subject), email or not", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(entity<AccountProfile>({ accountId: "a1", avatarUrl: "kept", firstName: "Kept" }));

      const code = await svc.codeForIdentity(identity({ emailVerified: false }));

      expect(typeof code).toBe("string");
      expect(accounts.save).not.toHaveBeenCalled();
    });

    it("refuses a disabled account even when the provider proved it", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 0 }));
      await expect(svc.codeForIdentity(identity())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuses an unverified email rather than matching an account on it", async () => {
      identities.findOne.mockResolvedValue(null);
      await expect(svc.codeForIdentity(identity({ emailVerified: false }))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(accounts.findOne).not.toHaveBeenCalled();
    });

    it("links an existing account on a first sign-in, matched by its verified email", async () => {
      identities.findOne.mockResolvedValue(null);
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", email: "alice@example.com", enabled: 1 }));
      profiles.findOne.mockResolvedValue(entity<AccountProfile>({ accountId: "a1" }));

      await svc.codeForIdentity(identity());

      expect(identities.create).toHaveBeenCalledWith({ accountId: "a1", provider: "google", subject: "sub-1" });
      expect(identities.save).toHaveBeenCalled();
    });

    it("refuses an unknown address while account creation is off", async () => {
      identities.findOne.mockResolvedValue(null);
      accounts.findOne.mockResolvedValue(null);
      await expect(svc.codeForIdentity(identity())).rejects.toBeInstanceOf(UnauthorizedException);
      expect(accounts.save).not.toHaveBeenCalled();
    });

    it("provisions at the floor of the permission model when account creation is on", async () => {
      settings.get.mockReturnValue(view({ passportAutoProvision: true }));
      identities.findOne.mockResolvedValue(null);
      accounts.findOne.mockResolvedValue(null);
      accounts.save.mockResolvedValue(entity<Account>({ id: "new", email: "alice@example.com", enabled: 1 }));
      profiles.findOne.mockResolvedValue(null);
      groups.findOne.mockResolvedValue(entity<Group>({ id: "g-default", isDefault: 1 }));

      await svc.codeForIdentity(identity());

      expect(accounts.create).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: null,
        isRoot: 0,
        enabled: 1,
      });
      expect(profiles.create).toHaveBeenCalledWith({ accountId: "new", firstName: "Alice", lastName: "Martin" });
      expect(cpg.guard.assignAccountToGroup).toHaveBeenCalledWith("new", "g-default");
    });

    it("provisions without a group when the install has no default one", async () => {
      settings.get.mockReturnValue(view({ passportAutoProvision: true }));
      identities.findOne.mockResolvedValue(null);
      accounts.findOne.mockResolvedValue(null);
      accounts.save.mockResolvedValue(entity<Account>({ id: "new", email: "alice@example.com", enabled: 1 }));
      profiles.findOne.mockResolvedValue(null);
      groups.findOne.mockResolvedValue(null);

      await svc.codeForIdentity(identity());

      expect(cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
    });

    it("fills only the empty profile fields, never replacing what is already there", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(
        entity<AccountProfile>({ accountId: "a1", avatarUrl: "mine", firstName: "Mine", lastName: null })
      );

      await svc.codeForIdentity(identity());

      expect(profiles.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: "mine", firstName: "Mine", lastName: "Martin" })
      );
    });

    it("writes nothing when every profile field the provider offers is already set", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(
        entity<AccountProfile>({ accountId: "a1", avatarUrl: "mine", firstName: "Mine", lastName: "Own" })
      );

      await svc.codeForIdentity(identity());

      expect(profiles.save).not.toHaveBeenCalled();
    });

    it("creates the profile row when the account has none yet", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(null);

      await svc.codeForIdentity(identity());

      expect(profiles.create).toHaveBeenCalledWith({ accountId: "a1" });
    });

    it("falls through to the email branch when the link points at a vanished account", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "gone" }));
      accounts.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(entity<Account>({ id: "a2", enabled: 1 }));
      profiles.findOne.mockResolvedValue(entity<AccountProfile>({ accountId: "a2" }));

      await svc.codeForIdentity(identity());

      expect(identities.save).toHaveBeenCalled();
    });
  });

  describe("redeem", () => {
    it("opens the very same session a password sign-in opens", async () => {
      const account = entity<Account>({ id: "a1", enabled: 1 });
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(account);
      profiles.findOne.mockResolvedValue(
        entity<AccountProfile>({ accountId: "a1", avatarUrl: "x", firstName: "x", lastName: "x" })
      );
      const code = await svc.codeForIdentity(identity());

      await svc.redeem(code, "UA/1.0", "1.2.3.4");

      expect(auth.openSessionFor).toHaveBeenCalledWith(account, "UA/1.0", "1.2.3.4");
    });

    it("refuses a code that was never minted", async () => {
      await expect(svc.redeem("nope")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuses the second use of a code", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(
        entity<AccountProfile>({ accountId: "a1", avatarUrl: "x", firstName: "x", lastName: "x" })
      );
      const code = await svc.codeForIdentity(identity());

      await svc.redeem(code);
      await expect(svc.redeem(code)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuses a code whose account was disabled in the meantime", async () => {
      identities.findOne.mockResolvedValue(entity<AccountIdentity>({ accountId: "a1" }));
      accounts.findOne.mockResolvedValueOnce(entity<Account>({ id: "a1", enabled: 1 }));
      profiles.findOne.mockResolvedValue(
        entity<AccountProfile>({ accountId: "a1", avatarUrl: "x", firstName: "x", lastName: "x" })
      );
      const code = await svc.codeForIdentity(identity());

      accounts.findOne.mockResolvedValueOnce(entity<Account>({ id: "a1", enabled: 0 }));
      await expect(svc.redeem(code)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
