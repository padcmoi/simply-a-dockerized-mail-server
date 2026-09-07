// The operators an account already signs in from: a sign-in from one that is
// not here is asked for a proof beyond the password, whatever the distance.

export interface KnownAddress {
  ip: string;
  city: string;
  loginCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface KnownNetwork {
  countryCode: string;
  asn: number;
  asnOrg: string;
  lastCity: string;
  lastIp: string;
  loginCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string;
  addresses: KnownAddress[];
}
