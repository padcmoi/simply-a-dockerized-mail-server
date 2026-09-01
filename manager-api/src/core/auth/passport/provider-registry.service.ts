import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import passport from "passport";
import { Repository } from "typeorm";
import { decryptSecret, encryptSecret } from "../api-token/api-token.cipher";
import { PassportProviderCredential } from "../../entities/passport-provider-credential.entity";
import { PASSPORT_PROVIDERS, findProvider } from "./passport-providers";

export interface ProviderState {
  id: string;
  label: string;
  /** Credentials exist and could be read back. */
  configured: boolean;
  /** Configured and switched on: the only state that draws a button. */
  enabled: boolean;
  /** The client id in force, echoed so an admin can check which one is stored. */
  clientId: string;
}

// Every external provider's credentials, read from the database once at boot and
// re-read whenever they change. The strategies Passport knows are rebuilt from
// that same read, so adding or replacing a client id and secret takes effect on
// the next sign-in with no restart, no rebuild and no file to edit.
//
// The secret is sealed at rest with the pepper the API already requires. It is
// decrypted here, held only for as long as it takes to build the strategy, and
// never leaves this process: no route ever answers with it.
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private state = new Map<string, ProviderState>();

  constructor(
    @InjectRepository(PassportProviderCredential) private readonly credentials: Repository<PassportProviderCredential>
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  private pepper() {
    const p = process.env.MANAGER_API_TOKEN_PEPPER;
    if (!p) throw new Error("MANAGER_API_TOKEN_PEPPER env var is required");
    return p;
  }

  list(): ProviderState[] {
    return PASSPORT_PROVIDERS.map(
      (p) => this.state.get(p.id) ?? { id: p.id, label: p.label, configured: false, enabled: false, clientId: "" }
    );
  }

  isEnabled(id: string) {
    return this.state.get(id)?.enabled === true;
  }

  // Rebuilds the whole registry from the table: every provider the build knows
  // is either registered with Passport under its own id, or unregistered so a
  // request for it fails to find a strategy rather than using a stale one.
  async reload() {
    const rows = await this.credentials.find().catch((err: unknown) => {
      // A boot before the table exists (first migration run) must not take the
      // API down: nothing is registered, and the next reload picks it up.
      this.logger.warn(`Provider credentials could not be read: ${String(err)}`);
      return [] as PassportProviderCredential[];
    });
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const next = new Map<string, ProviderState>();

    for (const definition of PASSPORT_PROVIDERS) {
      const row = byProvider.get(definition.id);
      const secret = row ? decryptSecret(row.clientSecretCipher, this.pepper()) : null;
      const configured = !!row && row.clientId.trim() !== "" && !!secret;
      const enabled = configured && row?.enabled === 1;

      next.set(definition.id, {
        id: definition.id,
        label: definition.label,
        configured,
        enabled,
        clientId: row?.clientId ?? "",
      });

      if (enabled && row && secret) {
        passport.use(definition.id, definition.create({ clientId: row.clientId, clientSecret: secret }));
      } else {
        // unuse() throws when nothing is registered under that name, which is
        // the normal case on a first boot.
        try {
          passport.unuse(definition.id);
        } catch {
          // nothing was registered, nothing to remove
        }
      }
    }

    this.state = next;
    return this.list();
  }

  // Writes one provider's credentials and re-registers immediately. The secret
  // is optional on an update: an admin changing only the client id, or only the
  // on/off flag, does not have to paste the secret again.
  async upsert(id: string, input: { clientId: string; clientSecret?: string; enabled: boolean }) {
    if (!findProvider(id)) throw new Error(`Unknown provider ${id}`);
    const existing = await this.credentials.findOne({ where: { provider: id } });
    const secret = input.clientSecret?.trim();
    if (!existing && !secret) throw new Error("A client secret is required the first time a provider is configured");

    await this.credentials.save(
      this.credentials.create({
        provider: id,
        clientId: input.clientId.trim(),
        clientSecretCipher: secret ? encryptSecret(secret, this.pepper()) : existing!.clientSecretCipher,
        enabled: input.enabled ? 1 : 0,
      })
    );
    return this.reload();
  }

  // Forgets a provider entirely: the row goes, the strategy is unregistered, and
  // the interface shows it as never configured again.
  async remove(id: string) {
    await this.credentials.delete({ provider: id });
    return this.reload();
  }
}
