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
