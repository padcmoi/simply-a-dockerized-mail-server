// Accounts as the administration reads them, and what each one owns.

export interface ManagerAccount {
  id: string;
  email: string;
  displayName: string | null;
  // Null for an account that never set a picture: the avatar falls back to the
  // initials of its name.
  avatarUrl: string | null;
  isRoot: boolean;
  enabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  // Whether every sign-in asks for a code: the list offers to remove the
  // factor only where there is one.
  twoFactorEnabled: boolean;
  groups: { id: string; name: string }[];
}

export interface AccountDetail {
  id: string;
  email: string;
  displayName: string | null;
  isRoot: boolean;
  enabled: boolean;
  groups: { id: string; name: string }[];
}

// The edit page's full reading: identity plus every profile field it can write.
export interface AccountEditView extends AccountDetail {
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  genders: string[];
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

export interface AccountOverview {
  account: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    isRoot: boolean;
    enabled: boolean;
    twoFactorEnabled: boolean;
    groups: { id: string; name: string }[];
  };
  domains: OwnedDomain[];
  recipients: OwnedRecipientSummary[];
  aliases: OwnedAlias[];
}

// The personal space's own overview: same owned resources, usage included.
export interface MySpaceOverview {
  domains: OwnedDomain[];
  recipients: OwnedRecipient[];
  aliases: OwnedAlias[];
}

export interface AccountOption {
  value: string;
  label: string;
}

export interface OwnedResource {
  id: number;
  domain: string;
  domainId: number | null;
  email?: string;
  source?: string;
  destination?: string;
}

export interface AssignableResponse {
  domains: { id: number; domain: string }[];
  items: OwnedResource[];
}
