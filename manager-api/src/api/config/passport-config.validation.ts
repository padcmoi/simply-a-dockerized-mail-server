import { z } from "zod";

// The two server-wide switches. Which providers exist and what their
// credentials are is not here: that is one call per provider, below.
export const updatePassportConfigSchema = z.object({
  passportEnabled: z.boolean(),
  passportAutoProvision: z.boolean(),
});

// One provider's credentials. The secret is optional on an update: an admin
// changing only the client id, or only the on/off flag, must not have to paste
// it again, and the stored one is kept. It is required the first time, which
// the registry enforces since only it knows whether a row already exists.
export const upsertProviderCredentialsSchema = z.object({
  clientId: z.string().trim().min(1).max(255),
  clientSecret: z.string().trim().min(1).max(255).optional(),
  enabled: z.boolean(),
});

export type UpdatePassportConfigDto = z.infer<typeof updatePassportConfigSchema>;
export type UpsertProviderCredentialsDto = z.infer<typeof upsertProviderCredentialsSchema>;
