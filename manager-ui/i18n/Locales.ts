export interface Locales {
  app: {
    name: string;
    language: string;
  };
  nav: {
    dashboard: string;
    domains: string;
    recipients: string;
    aliases: string;
    quotas: string;
    sieve: string;
    sieveLong: string;
    profile: string;
    signOut: string;
    appearance: string;
    light: string;
    dark: string;
    system: string;
    toggleSidebar: string;
  };
  common: {
    active: string;
    inactive: string;
    enabled: string;
    yes: string;
    no: string;
    save: string;
    add: string;
    block: string;
    create: string;
    delete: string;
    refresh: string;
    viewAll: string;
    loading: string;
    required: string;
    failed: string;
    domain: string;
    address: string;
    bytes: string;
    messages: string;
    lastActivity: string;
  };
  login: {
    title: string;
    subtitle: string;
    username: string;
    password: string;
    submit: string;
    failed: string;
  };
  dashboard: {
    subtitle: string;
    stats: {
      domains: string;
      recipients: string;
      aliases: string;
      blockedSenders: string;
      activeCount: string;
      enabledCount: string;
      forwarders: string;
    };
    recent: {
      domains: string;
      recipients: string;
      noDomains: string;
      noDomainsHint: string;
      noRecipients: string;
      noRecipientsHint: string;
      addDomain: string;
      addRecipient: string;
      quotaLabel: string;
    };
  };
  domains: {
    alertTitle: string;
    alertDescription: string;
    capacity: {
      title: string;
      hint: string;
      total: string;
      free: string;
      reserved: string;
      assignable: string;
    };
    form: {
      title: string;
      fqdn: string;
      quotaMb: string;
      quotaMax: string;
      active: string;
      submit: string;
    };
    table: {
      id: string;
      domain: string;
      active: string;
      quotaMb: string;
    };
    toast: {
      added: string;
      addFailed: string;
      loadFailed: string;
      quotaTooHigh: string;
    };
  };
  recipients: {
    alertTitle: string;
    alertDescription: string;
    form: {
      title: string;
      domain: string;
      domainPlaceholder: string;
      localPart: string;
      password: string;
      quotaBytes: string;
      submit: string;
    };
    table: {
      address: string;
      domain: string;
      quota: string;
      active: string;
    };
    toast: {
      pickDomain: string;
      created: string;
      createFailed: string;
    };
  };
  aliases: {
    alertTitle: string;
    form: {
      title: string;
      domain: string;
      domainPlaceholder: string;
      localPart: string;
      destination: string;
      destinationPlaceholder: string;
      submit: string;
    };
    table: {
      from: string;
      to: string;
      domain: string;
    };
    toast: {
      pickDomain: string;
      created: string;
      createFailed: string;
    };
  };
  quotas: {
    alertTitle: string;
    perDomain: string;
    perRecipient: string;
  };
  sieve: {
    alertTitle: string;
    form: {
      title: string;
      sender: string;
      senderPlaceholder: string;
      submit: string;
    };
    table: {
      sender: string;
      enabled: string;
      created: string;
    };
    toast: {
      blocked: string;
      failed: string;
    };
  };
  profile: {
    alertTitle: string;
    alertDescription: string;
    identity: string;
    displayName: string;
    displayNameHint: string;
    email: string;
    emailHint: string;
    avatarUrl: string;
    avatarUrlHint: string;
    emailInvalid: string;
    urlInvalid: string;
    save: string;
    toast: {
      updated: string;
      updateFailed: string;
      loadFailed: string;
    };
  };
}
