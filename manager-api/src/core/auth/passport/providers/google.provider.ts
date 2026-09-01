import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import type { PassportProviderDefinition, ProviderIdentity } from "../provider.types";

const PROVIDER_ID = "google";

// Normalization only, never authorization: who may sign in, who gets an account
// and who is refused is PassportAuthService's decision, taken once for every
// provider.
function toIdentity(profile: Profile): ProviderIdentity {
  const primary = profile.emails?.[0];
  return {
    provider: PROVIDER_ID,
    subject: profile.id,
    email: primary?.value?.trim().toLowerCase() ?? "",
    // Google's email_verified arrives as a boolean on some payloads and a
    // string on others; both are accepted, nothing else is. Unverified means
    // the provider never proved the address, so the service must not match an
    // account on it.
    emailVerified: primary?.verified === true || String(primary?.verified) === "true",
    firstName: profile.name?.givenName?.trim() || null,
    lastName: profile.name?.familyName?.trim() || null,
    picture: profile.photos?.[0]?.value ?? null,
  };
}

// Built on demand from credentials read out of the database, not at import time
// from the environment: that is what lets an admin add or replace them in the
// interface and have the next sign-in use them, with no restart.
//
// `callbackURL` is a placeholder here and settled per request by
// PassportProviderGuard, from the manager URL an admin can change at any time.
export const googleProvider: PassportProviderDefinition = {
  id: PROVIDER_ID,
  label: "Google",
  scope: ["openid", "email", "profile"],
  create({ clientId, clientSecret }) {
    return new Strategy(
      { clientID: clientId, clientSecret, callbackURL: "/", scope: googleProvider.scope },
      (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
        done(null, toIdentity(profile));
      }
    );
  },
};
