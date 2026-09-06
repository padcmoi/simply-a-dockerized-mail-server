import { z } from "zod";
import { LOGIN_CHALLENGE_ORDERS } from "../../core/settings/app-settings.service";

/** Half the Earth's circumference: past it no two points on the globe are far. */
export const MAX_LOGIN_RADIUS_KM = 20037;

export const updateLoginRiskSchema = z.object({
  // How far a sign-in may be from where the account usually signs in before it
  // is asked for more than a password. Zero turns the check off.
  loginRadiusKm: z.coerce.number().int().min(0).max(MAX_LOGIN_RADIUS_KM),
  // Which of the two proofs is offered first. The authenticator app is not in
  // the list: it always comes first when the account has one, and it is then
  // the only thing asked.
  loginChallengeOrder: z.enum(LOGIN_CHALLENGE_ORDERS),
});

export type UpdateLoginRiskDto = z.infer<typeof updateLoginRiskSchema>;
