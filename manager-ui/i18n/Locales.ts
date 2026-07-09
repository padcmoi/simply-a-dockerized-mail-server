export interface Locales {
  app: {
    name: string;
    language: string;
  };
  nav: {
    home: string;
    dashboard: string;
    domains: string;
    rspamd: string;
    postfix: string;
    recipients: string;
    aliases: string;
    quotas: string;
    application: string;
    sieve: string;
    sieveLong: string;
    accounts: string;
    groups: string;
    profile: string;
    apiTokens: string;
    signOut: string;
    appearance: string;
    light: string;
    dark: string;
    system: string;
    toggleSidebar: string;
    rootBadge: string;
    noGroupBadge: string;
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
    search: string;
    itemsPerPage: string;
    noResults: string;
    totalCount: string;
  };
  confirm: {
    title: string;
    description: string;
    proceed: string;
    proceedAction: string;
    countdownHint: string;
    countdownHintAction: string;
    clicksHint: string;
    clicksHintAction: string;
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
    listLocked: string;
    capacity: {
      title: string;
      hint: string;
      total: string;
      free: string;
      reserved: string;
      assignable: string;
      occupancy: string;
    };
    form: {
      title: string;
      fqdn: string;
      quotaMb: string;
      quotaMax: string;
      quotaMin: string;
      quotaRange: string;
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
      quotaTooLow: string;
    };
    adminModal: {
      button: string;
      title: string;
      fqdnInvalid: string;
      dangerZone: string;
      delete: string;
      confirmDelete: string;
      confirmDeleteDesc: string;
      saved: string;
      saveFailed: string;
      deleted: string;
      deleteFailed: string;
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
      quotaMb: string;
      quotaMin: string;
      submit: string;
    };
    table: {
      address: string;
      domain: string;
      quota: string;
      used: string;
      active: string;
    };
    toast: {
      pickDomain: string;
      created: string;
      createFailed: string;
      quotaTooLow: string;
    };
    postmaster: {
      badge: string;
      locked: string;
    };
    editModal: {
      button: string;
      title: string;
      saved: string;
      saveFailed: string;
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
      updated: string;
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
    permissions: {
      title: string;
      root: string;
      globalTitle: string;
      domainTitle: string;
      empty: string;
      loadFailed: string;
    };
  };
  accounts: {
    alertTitle: string;
    alertDescription: string;
    inviteButton: string;
    backToList: string;
    table: {
      username: string;
      name: string;
      email: string;
      group: string;
      noGroup: string;
      manageGroups: string;
      editAccount: string;
      rootAccess: string;
      status: string;
      lastLogin: string;
    };
    invite: {
      title: string;
      emailLabel: string;
      groupLabel: string;
      groupHint: string;
      groupPlaceholder: string;
      submit: string;
    };
    groupsPage: {
      alertTitle: string;
      alertDescription: string;
      title: string;
      pickPlaceholder: string;
      add: string;
      removeTooltip: string;
      empty: string;
    };
    editPage: {
      alertTitle: string;
      alertDescription: string;
      title: string;
      nameLabel: string;
      emailLabel: string;
      avatarUrlLabel: string;
      enabledLabel: string;
      enabledHint: string;
      save: string;
      toast: {
        saved: string;
        saveFailed: string;
        loadFailed: string;
      };
    };
    toast: {
      invited: string;
      inviteFailed: string;
      revoked: string;
      revokeFailed: string;
      groupUpdated: string;
      groupUpdateFailed: string;
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
    groupLabel: string;
    noGroup: string;
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
      statusGenerated: string;
      statusMissing: string;
      statusMatch: string;
      statusMismatch: string;
      dnsMatch: string;
      dnsMismatch: string;
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
      learned: string;
      unavailable: string;
      noHistory: string;
    };
    rspamdPage: {
      subtitle: string;
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
    owner: {
      title: string;
      current: string;
      unassigned: string;
      pickPlaceholder: string;
      change: string;
      saved: string;
      saveFailed: string;
    };
    admin: {
      subtitle: string;
    };
    status: {
      title: string;
      hint: string;
      activated: string;
      deactivated: string;
      toggleFailed: string;
    };
  };
  postfixPage: {
    subtitle: string;
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
    bayes: {
      title: string;
      noData: string;
      symbol: string;
      type: string;
      learns: string;
      users: string;
    };
    actions: {
      title: string;
      hint: string;
      softReject: string;
      greylist: string;
      addHeader: string;
      rewriteSubject: string;
      reject: string;
      negativeError: string;
      orderError: string;
      save: string;
      saved: string;
      saveFailed: string;
      readOnlyHint: string;
      reset: string;
      confirmReset: string;
      confirmResetDesc: string;
      resetDone: string;
      resetFailed: string;
    };
  };
  apiTokens: {
    alertTitle: string;
    alertDescription: string;
    listTitle: string;
    newToken: string;
    empty: string;
    active: string;
    expired: string;
    revoked: string;
    regenerate: string;
    revokeToken: string;
    deleteToken: string;
    allIps: string;
    noExpiry: string;
    never: string;
    modal: {
      createTitle: string;
      editTitle: string;
      name: string;
      namePlaceholder: string;
      allowedIps: string;
      allowedIpsHint: string;
      expiresAt: string;
      expiresAtHint: string;
    };
    reveal: {
      title: string;
      warning: string;
      keyLabel: string;
      copy: string;
      copied: string;
      done: string;
    };
    table: {
      clientId: string;
      ips: string;
      expires: string;
      lastUsed: string;
    };
    toast: {
      created: string;
      updated: string;
      revoked: string;
      revokeFailed: string;
      regenerated: string;
      regenerateFailed: string;
      deleted: string;
      deleteFailed: string;
      keySaved: string;
      keyNotSaved: string;
      saveFailed: string;
      loadFailed: string;
    };
  };
  groups: {
    alertTitle: string;
    alertDescription: string;
    newGroup: string;
    empty: string;
    backToList: string;
    noDescription: string;
    defaultBadge: string;
    table: {
      name: string;
      description: string;
      owner: string;
      members: string;
    };
    form: {
      title: string;
      name: string;
      description: string;
      submit: string;
      isDefault: string;
      isDefaultHint: string;
    };
    toast: {
      loadFailed: string;
      created: string;
      createFailed: string;
      updated: string;
      updateFailed: string;
      deleted: string;
      deleteFailed: string;
    };
    confirmDelete: string;
    detail: {
      nameLabel: string;
      descriptionLabel: string;
      save: string;
      saved: string;
      saveFailed: string;
      tabs: {
        owner: string;
        members: string;
        application: string;
        domain: string;
      };
      alerts: {
        info: { title: string; description: string };
        owner: { title: string; description: string };
        members: { title: string; description: string };
        application: { title: string; description: string };
        domain: { title: string; description: string };
      };
      owner: {
        title: string;
        unassigned: string;
        pickPlaceholder: string;
        change: string;
        saved: string;
        saveFailed: string;
      };
      members: {
        title: string;
        empty: string;
        pickPlaceholder: string;
        add: string;
        addFailed: string;
        remove: string;
        removeFailed: string;
      };
      permissions: {
        saved: string;
        saveFailed: string;
      };
    };
    permissions: {
      tabs: {
        global: string;
        domain: string;
      };
      resources: {
        sieve: string;
        rspamd: string;
        postfix: string;
        accounts: string;
        apiTokens: string;
        groups: string;
        domains: string;
        domain: string;
        recipients: string;
        aliases: string;
        quotas: string;
        dkim: string;
        admin: string;
        superadmin: string;
      };
      actionsLabel: {
        access: string;
        read: string;
        create: string;
        modify: string;
        delete: string;
      };
      autosaveHint: string;
      saving: string;
      checkAll: string;
      uncheckAll: string;
      checkAllVisible: string;
      uncheckAllVisible: string;
      selectDomain: string;
      selectDomainPlaceholder: string;
      noDomainsAssigned: string;
    };
  };
}
