import type { Strategy } from "passport";

// What a provider hands the service once it has answered. Normalized here so no
// provider's own payload shape reaches anything downstream.
export interface ProviderIdentity {
  provider: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

// A provider this build can sign someone in with. `create` builds the Passport
// strategy from credentials read at runtime, which is what lets them live in the
// database and change without a restart: the registry builds a new strategy and
// hands it to passport.use() under the same name.
//
// `local` is not one of these: it verifies a password this server holds itself
// and needs no credentials, so it stays a plain DI-registered strategy.
export interface PassportProviderDefinition {
  id: string;
  label: string;
  /** What the provider is asked for. Identity only, never a data scope. */
  scope: string[];
  /**
   * Builds the Passport strategy. Its verify step only normalizes the payload
   * into a ProviderIdentity and hands it to `done`, so it lands on the request
   * for the controller; it decides nothing.
   */
  create(credentials: ProviderCredentials): Strategy;
}

// These types live apart from the catalog on purpose: a provider file imports
// them, and the catalog imports the provider files, so putting both in one
// module would close the import cycle.
