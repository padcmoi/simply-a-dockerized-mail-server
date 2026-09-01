import type { PassportProviderDefinition } from "./provider.types";
import { googleProvider } from "./providers/google.provider";

// The providers this build can sign someone in with. Adding one is a file in
// ./providers plus one line here: nothing else in the flow, the settings, the
// API or the interface is provider-aware.
//
// Credentials are NOT here. They live in `passport_provider_credentials`, read
// at boot and re-read whenever an admin changes them, so a provider is
// configured from the interface rather than from a file.
export const PASSPORT_PROVIDERS: readonly PassportProviderDefinition[] = [googleProvider];

export const PASSPORT_PROVIDER_IDS = PASSPORT_PROVIDERS.map((p) => p.id);

export function findProvider(id: string) {
  return PASSPORT_PROVIDERS.find((p) => p.id === id);
}

export type { PassportProviderDefinition, ProviderCredentials, ProviderIdentity } from "./provider.types";
