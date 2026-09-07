import { z } from "zod";
import { LOGIN_CHALLENGE_ORDERS } from "../../core/settings/app-settings.service";

/** Half the Earth's circumference: past it no two points on the globe are far. */
export const MAX_LOGIN_RADIUS_KM = 20037;
/** A year: past that the answer a provider gave is guesswork, not a cache. */
export const MAX_GEOIP_CACHE_DAYS = 365;
export const MAX_LOGIN_ADDRESS_DAYS = 365;
export const MAX_LOGIN_NETWORK_DAYS = 365;

export const updateLoginRiskSchema = z.object({
  // How far a sign-in may be from where the account usually signs in before it
  // is asked for more than a password. Zero turns the check off.
  loginRadiusKm: z.coerce.number().int().min(0).max(MAX_LOGIN_RADIUS_KM),
  // Which of the two proofs is offered first. The authenticator app is not in
  // the list: it always comes first when the account has one, and it is then
  // the only thing asked.
  loginChallengeOrder: z.enum(LOGIN_CHALLENGE_ORDERS),
  loginChallengeExclusive: z.boolean(),
  // How long an address keeps the answer the geolocation provider gave for it.
  geoipCacheDays: z.coerce.number().int().min(1).max(MAX_GEOIP_CACHE_DAYS),
  loginAddressDays: z.coerce.number().int().min(1).max(MAX_LOGIN_ADDRESS_DAYS),
  loginNetworkDays: z.coerce.number().int().min(1).max(MAX_LOGIN_NETWORK_DAYS),
});

export type UpdateLoginRiskDto = z.infer<typeof updateLoginRiskSchema>;
