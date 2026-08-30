// What the invitation form works with.

// A domain as the invite page picks it: enough to name it and show its owner.
export interface InviteDomainOption {
  id: number;
  domain: string;
  ownerEmail: string | null;
}

export interface InviteInfo {
  // Null = open registration token: the visitor chooses their own address.
  email: string | null;
  groups: string[];
  expiresAt: string | null;
}
