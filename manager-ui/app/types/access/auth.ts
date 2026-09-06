// The authenticated account, in the shapes the auth endpoints answer with.

export interface Session {
  accountId?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  // Email is the login identity now; displayName is the friendly label (from the
  // profile) shown in the sidebar, falling back to the email when unset.
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isRoot?: boolean;
  mailEnabled?: boolean;
  // False while the account has chosen no security question. The API refuses
  // almost everything until it has one, so the interface takes it there first.
  securityQuestionSet?: boolean;
  groups?: { id: string; name: string }[];
}

// The subset of GET /auth/jwt/me the store keeps in the session (the endpoint
// also returns phone/address/geo, consumed only by the profile page).
export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isRoot: boolean;
  mailEnabled: boolean;
  twoFactorEnabled: boolean;
  securityQuestionSet: boolean;
  groups: { id: string; name: string }[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// What a sign-in answers when the account asks for a second factor: no
// session yet, a challenge to bring back with a code.
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challenge: string;
  expiresAt: string;
}

// What a sign-in answers when it came from further away than the account
// usually signs in from: no session yet, and one more thing to prove. `method`
// says which, `hint` names the masked address a code went to, `question` is
// what to answer when there is no mail to send one.
export interface MfaChallenge {
  mfaRequired: true;
  method: "email" | "question";
  challenge: string;
  expiresAt: string;
  hint?: string;
  question?: string;
  // The other proof this same challenge could switch to, when the server can
  // offer it: absent on a server that cannot send mail, or for an account with
  // no security question. The button appears only where this does.
  alternative?: "email" | "question";
}

export interface SecurityQuestionStatus {
  set: boolean;
  // The key of the chosen question, translated on this side. Never a sentence:
  // the wording belongs to whoever reads it, in their own language.
  question: string | null;
  // The keys the API offers. The interface carries no list of its own.
  catalogue: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
}

// The identity card's own reading of GET /auth/jwt/me: the editable fields,
// plus the title catalog the API owns and whether a password exists at all (an
// account created by an external sign-in has none until it sets one).
export interface MeProfile {
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  genders: string[];
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
  phone: string | null;
  addressLine: string | null;
  addressComplement: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
}

// PATCH /auth/jwt/me payload: the login email plus every editable profile field.
export interface UpdateProfileInput {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  addressComplement?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}
