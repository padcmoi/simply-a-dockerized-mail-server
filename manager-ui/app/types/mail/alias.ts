// An alias, in the shapes the API answers with.

export interface AliasRow {
  id: number;
  source: string;
  destination: string;
  domain: string;
  // The account the alias belongs to, joined by the list route: the id is what
  // the owner column links to, the address is what it shows. Both null when the
  // alias belongs to nobody.
  ownerId: string | null;
  ownerEmail: string | null;
  // `virtual_aliases.last_activity` carries `ON UPDATE current_timestamp()`:
  // it stamps the row's last edit, not mail traffic. Postfix-legacy name.
  lastActivity: string | null;
}

// What the edit route answers: no activity stamp, but the owner it can hand over.
export interface AliasDetail {
  id: number;
  source: string;
  destination: string;
  domain: string;
  ownerEmail: string | null;
}

// What an account owns, from the personal space and the account detail.
export interface OwnedAlias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}
