// The signed-in account's effective permissions, as the store holds them.

export interface GlobalPermission {
  resource: string;
  action: string;
}

export interface DomainPermission {
  domainId: number;
  // Resolved server-side (see JwtAuthController.withDomainNames); "#<id>" when
  // the domain was deleted. Lets the UI show the FQDN even for a domain the
  // caller does not own.
  domainName: string;
  resource: string;
  action: string;
}

export interface PermissionsData {
  global: GlobalPermission[];
  domain: DomainPermission[];
}
