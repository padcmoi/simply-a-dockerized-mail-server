import { z } from "zod";

// The one-time code a provider's callback handed the browser, traded here for a
// session. Opaque and short-lived (see PassportExchangeStore), so nothing beyond
// its shape is worth validating.
export const passportExchangeSchema = z.object({
  code: z.string().min(16).max(512),
});

export type PassportExchangeDto = z.infer<typeof passportExchangeSchema>;
