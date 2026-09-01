import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomPermissionGuardService } from "../../custom-permission-guard/custom-permission-guard.service";
import { AccountIdentity } from "../../entities/account-identity.entity";
import { AccountProfile } from "../../entities/account-profile.entity";
import { Account } from "../../entities/account.entity";
import { Group } from "../../entities/group.entity";
import { AppSettingsService } from "../../settings/app-settings.service";
import { JwtAuthService } from "../jwt/jwt.service";
import { PassportExchangeStore } from "./passport-exchange.store";
import { PASSPORT_PROVIDERS, findProvider, type ProviderIdentity } from "./passport-providers";
import { ProviderRegistryService } from "./provider-registry.service";

@Injectable()
export class PassportAuthService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountIdentity) private readonly identities: Repository<AccountIdentity>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    private readonly auth: JwtAuthService,
    private readonly cpg: CustomPermissionGuardService,
    private readonly settings: AppSettingsService,
    private readonly exchange: PassportExchangeStore,
    private readonly registry: ProviderRegistryService
  ) {}

  // The manager URL is a hard requirement, not a nicety: the callback handed to
  // a provider has to be an absolute public URL, and the exact one registered
  // there. It cannot be guessed from the request, whose Host behind the
  // interface's proxy is an internal hop over http, which a provider refuses.
  managerUrlSet() {
    return this.settings.get().managerUrl.trim() !== "";
  }

  // Whether a provider may actually be used right now: the manager URL is set,
  // the master switch is on, the provider is on, and its credentials exist.
  // Anything else is off, and off means its button is never drawn rather than
  // drawn and broken.
  isUsable(id: string) {
    if (!this.managerUrlSet()) return false;
    if (!this.settings.get().passportEnabled) return false;
    if (!findProvider(id)) return false;
    return this.registry.isEnabled(id);
  }

  // What the login screen may know before anyone has signed in: which buttons
  // to draw. Whether this server hands out accounts is NOT here, on purpose.
  publicProviders() {
    return PASSPORT_PROVIDERS.filter((p) => this.isUsable(p.id)).map((p) => ({ id: p.id, label: p.label }));
  }

  // The administration's view: every provider this build knows, whether its
  // credentials are present, and whether it is switched on. A provider that is
  // not configured is shown, and shown as not configured, rather than hidden:
  // an admin looking for it must find out why it is not there.
  // Each provider's state, plus the two URLs its console has to carry. They are
  // computed here rather than written in a document because getting them wrong
  // is the single most common way a sign-in fails, and the page can only show
  // them if the server hands them over.
  adminProviders() {
    return this.registry.list().map((p) => ({
      ...p,
      javascriptOrigin: this.origin(),
      redirectUri: this.callbackUrl(p.id),
    }));
  }

  private origin() {
    return this.settings.get().managerUrl.trim().replace(/\/+$/, "");
  }

  // Absolute, and built only from the manager URL: this is the value a provider
  // compares against what is registered in its console, so a guess would fail
  // every sign-in with a mismatch. isUsable() has already refused when the
  // manager URL is unset, so this is never reached without one.
  callbackUrl(providerId: string) {
    const base = this.settings.get().managerUrl.trim().replace(/\/+$/, "");
    return `${base}/api/v1/auth/passport/${providerId}/callback`;
  }

  // Relative on purpose, unlike the callback: the browser is already on this
  // origin, so a path is always right and nothing has to be configured for it.
  loginRedirect(params: Record<string, string>) {
    return `/login?${new URLSearchParams(params).toString()}`;
  }

  // The end of a provider's callback: the identity it proved becomes an account
  // id, and that id becomes a one-time code for the interface to trade in.
  async codeForIdentity(identity: ProviderIdentity) {
    const account = await this.findOrCreate(identity);
    if (account.enabled !== 1) throw new UnauthorizedException("This account is disabled");
    await this.fillMissingProfile(account.id, identity);
    return this.exchange.mint(account.id);
  }

  // The interface trading that code for the same session a password sign-in
  // opens, so everything downstream is unaware there was ever a second way in.
  async redeem(code: string, ua?: string, ip?: string) {
    const accountId = this.exchange.claim(code);
    if (!accountId) throw new UnauthorizedException("This sign-in link has expired, please start again");
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account || account.enabled !== 1) throw new UnauthorizedException("This account is disabled");
    return this.auth.openSessionFor(account, ua, ip);
  }

  private async findOrCreate(identity: ProviderIdentity) {
    // The subject first: it is the only identifier a provider promises never to
    // change or reassign, so a linked account is found by it even after the
    // address on either side has moved.
    const linked = await this.identities.findOne({
      where: { provider: identity.provider, subject: identity.subject },
    });
    if (linked) {
      const account = await this.accounts.findOne({ where: { id: linked.accountId } });
      if (account) return account;
    }

    // A provider sets a verified flag on an address it has actually proved.
    // Without this check an account elsewhere could present any address it
    // liked and land on the manager account that answers to it.
    if (!identity.email || !identity.emailVerified) {
      throw new UnauthorizedException("The provider did not confirm a verified email address for this identity");
    }

    const byEmail = await this.accounts.findOne({ where: { email: identity.email } });
    if (byEmail) {
      // First sign-in with this provider on an account that already existed
      // here: the link is written now, and every later sign-in comes through
      // the branch above.
      await this.link(byEmail.id, identity);
      return byEmail;
    }

    if (!this.settings.get().passportAutoProvision) {
      throw new UnauthorizedException("No account here answers to this address");
    }
    return this.provision(identity);
  }

  private link(accountId: string, identity: ProviderIdentity) {
    return this.identities.save(this.identities.create({ accountId, provider: identity.provider, subject: identity.subject }));
  }

  // The floor of the permission model, nothing above it: no password (so this
  // account cannot be reached by the password form until it sets one), not
  // root, and the default group every account gets. Anything more is granted
  // afterwards, by hand, by someone who already holds it.
  private async provision(identity: ProviderIdentity) {
    const account = await this.accounts.save(
      this.accounts.create({ email: identity.email, password: null, isRoot: 0, enabled: 1 })
    );
    await this.link(account.id, identity);
    await this.profiles.save(
      this.profiles.create({ accountId: account.id, firstName: identity.firstName, lastName: identity.lastName })
    );
    const defaultGroup = await this.groups.findOne({ where: { isDefault: 1 } });
    if (defaultGroup) await this.cpg.guard.assignAccountToGroup(account.id, defaultGroup.id);
    return account;
  }

  // The provider's picture and names fill the empty profile fields, and only
  // the empty ones. A field that already carries a value keeps it: whatever is
  // there was chosen here, and a sign-in is no reason to overwrite it on every
  // visit.
  private async fillMissingProfile(accountId: string, identity: ProviderIdentity) {
    const profile = (await this.profiles.findOne({ where: { accountId } })) ?? this.profiles.create({ accountId });
    let dirty = false;
    if (identity.picture && !profile.avatarUrl) {
      profile.avatarUrl = identity.picture;
      dirty = true;
    }
    if (identity.firstName && !profile.firstName) {
      profile.firstName = identity.firstName;
      dirty = true;
    }
    if (identity.lastName && !profile.lastName) {
      profile.lastName = identity.lastName;
      dirty = true;
    }
    if (dirty) await this.profiles.save(profile);
  }
}
