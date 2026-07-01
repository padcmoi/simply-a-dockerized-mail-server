export interface Locales {
  app: {
    name: string;
    language: string;
  };
  nav: {
    dashboard: string;
    domains: string;
    rspamd: string;
    recipients: string;
    aliases: string;
    quotas: string;
    sieve: string;
    sieveLong: string;
    accounts: string;
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
    cancel: string;
    invite: string;
    revoke: string;
    manage: string;
  };
  confirm: {
    title: string;
    description: string;
    proceed: string;
    countdownHint: string;
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
      accounts: string;
      activeCount: string;
      enabledCount: string;
      forwarders: string;
    };
    disk: {
      title: string;
      used: string;
      free: string;
      reserved: string;
    };
    chart: {
      recipientsPerDomain: string;
      recipients: string;
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
  accounts: {
    alertTitle: string;
    alertDescription: string;
    inviteButton: string;
    table: {
      username: string;
      name: string;
      email: string;
      domains: string;
      status: string;
      lastLogin: string;
    };
    invite: {
      title: string;
      emailLabel: string;
      domainsLabel: string;
      domainsHint: string;
      submit: string;
    };
    acl: {
      title: string;
      hint: string;
      save: string;
    };
    toast: {
      invited: string;
      inviteFailed: string;
      revoked: string;
      revokeFailed: string;
      aclSaved: string;
      aclFailed: string;
      loadFailed: string;
    };
    confirmRevoke: string;
  };
  invite: {
    loading: string;
    invalid: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    domainsLabel: string;
    allDomains: string;
    usernameLabel: string;
    usernameHint: string;
    nameLabel: string;
    nameHint: string;
    passwordLabel: string;
    submit: string;
    success: string;
    successHint: string;
    goToLogin: string;
    toast: {
      failed: string;
    };
  };
  domainDashboard: {
    disk: {
      title: string;
      used: string;
      free: string;
      allocated: string;
      unlimited: string;
    };
    topMailboxes: {
      title: string;
      noData: string;
    };
    dkim: {
      title: string;
      noKey: string;
      generate: string;
      rotate: string;
      copied: string;
      confirmGenerate: string;
      confirmGenerateDesc: string;
      confirmRotate: string;
      confirmRotateDesc: string;
      toast: {
        rotated: string;
        rotateFailed: string;
        deleted: string;
        deleteFailed: string;
      };
    };
    rspamd: {
      title: string;
      scanned: string;
      spam: string;
      ham: string;
      greylist: string;
      unavailable: string;
      noHistory: string;
      recentScans: string;
    };
    postfix: {
      title: string;
      active: string;
      deferred: string;
      hold: string;
      incoming: string;
      unavailable: string;
      global: string;
      forDomain: string;
    };
    blockedSenders: string;
    messages: string;
    activity: string;
    autoRefresh: {
      label: string;
      off: string;
    };
  };
  rspamdPage: {
    subtitle: string;
    uptime: string;
    history: {
      title: string;
      noData: string;
    };
    col: {
      from: string;
      to: string;
      action: string;
      score: string;
      size: string;
      time: string;
    };
  };
}
