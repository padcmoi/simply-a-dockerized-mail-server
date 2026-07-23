export interface Locales {
  app: {
    name: string;
    language: string;
  };
  // Mirrors API_ERROR_CODES in manager-api/src/core/common/api-error.ts: the
  // API sends a code and the values its sentence needs, this side owns the
  // sentence. Resolved by useApiError().
  apiErrors: {
    validation: {
      failed: string;
    };
    recipients: {
      postmasterReserved: string;
      alreadyExists: string;
      notFound: string;
      postmasterImmutable: string;
      postmasterUndeletable: string;
      quotaBelowUsage: string;
      quotaExceedsDomain: string;
    };
  };
  // Sidebar nav destinations only -- one entry per actual link. Anything
  // that isn't a nav link (breadcrumb-only labels, the user dropdown,
  // theme toggle, badges, ...) lives in `layout` instead.
  presence: {
    online: string;
    lastSeen: string;
    offline: string;
  };
  nav: {
    dashboard: string;
    domains: string;
    rspamd: string;
    postfix: string;
    recipients: string;
    aliases: string;
    quotas: string;
    admin: string;
    tickets: string;
    sieve: string;
    accounts: string;
    groups: string;
    apiTokens: string;
  };
  notifications: {
    title: string;
    empty: string;
    markAllRead: string;
    someone: string;
    saved: string;
    pageHint: string;
    pageDescription: string;
    channel: { inApp: string; email: string };
    source: { support: string };
    sourceHint: { support: string };
    event: {
      "ticket-created": string;
      "ticket-replied": string;
      "ticket-taken": string;
      "ticket-status": string;
    };
  };
  tickets: {
    alertTitle: string;
    alertDescription: string;
    createTitle: string;
    empty: string;
    table: {
      subject: string;
      status: string;
      onlyMine: string;
      author: string;
      visibility: string;
      assignee: string;
      updated: string;
      unassigned: string;
      closeOwn: string;
    };
    status: { open: string; in_progress: string; resolved: string; closed: string };
    visibility: { public: string; private: string };
    form: {
      title: string;
      subject: string;
      subjectPlaceholder: string;
      body: string;
      bodyPlaceholder: string;
      visibility: string;
      public: string;
      private: string;
      publicHint: string;
      privateHint: string;
      submit: string;
      backToList: string;
    };
    editor: {
      undo: string;
      redo: string;
      bold: string;
      italic: string;
      strike: string;
      code: string;
      bulletList: string;
      orderedList: string;
      quote: string;
      codeBlock: string;
      link: string;
      clear: string;
    };
    detail: {
      title: string;
      backToList: string;
      openedBy: string;
      reply: string;
      replyPlaceholder: string;
      send: string;
      take: string;
      authorCannotTake: string;
      changeStatus: string;
      authorCloseHint: string;
      sent: string;
      seen: string;
      seenTitle: string;
      notSeenYet: string;
      seenBy: string;
      typing: string;
      closedNotice: string;
      loadOlder: string;
      noMessages: string;
      you: string;
      unknown: string;
    };
    toast: {
      created: string;
      createFailed: string;
      replied: string;
      replyFailed: string;
      taken: string;
      takeFailed: string;
      statusChanged: string;
      statusFailed: string;
    };
  };
  layout: {
    home: string;
    sieveLong: string;
    profile: string;
    preferences: string;
    signOut: string;
    appearance: string;
    light: string;
    dark: string;
    system: string;
    toggleSidebar: string;
    refreshData: string;
    rootBadge: string;
    noGroupBadge: string;
  };
  preferences: {
    title: string;
    subtitle: string;
    language: string;
    appearance: string;
    pageSize: string;
    pageSizeHint: string;
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
    // `virtual_users.last_activity` / `virtual_aliases.last_activity` carry
    // `ON UPDATE current_timestamp()`: they timestamp the row's last edit, not
    // mail traffic. The columns keep their postfix-legacy names; the UI says
    // what they actually hold. Not to be confused with `lastActivity` above,
    // which labels dovecot's own delivery counter on the quotas page.
    lastModification: string;
    cancel: string;
    close: string;
    back: string;
    clear: string;
    apply: string;
    invite: string;
    revoke: string;
    manage: string;
    search: string;
    itemsPerPage: string;
    noResults: string;
    totalCount: string;
  };
  // Full-page error states rendered by app/error.vue (Nuxt error boundary).
  error: {
    generic: { title: string; description: string };
    403: { title: string; description: string };
    404: { title: string; description: string };
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
    email: string;
    emailInvalid: string;
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
    backToList: string;
    chart: {
      title: string;
      pending: string;
    };
    capacity: {
      title: string;
      hint: string;
      total: string;
      free: string;
      reserved: string;
      assignable: string;
      allocatable: string;
      occupancy: string;
    };
    form: {
      title: string;
      fqdn: string;
      fqdnInvalid: string;
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
      fqdnLocked: string;
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
    backToList: string;
    confirmDeleteDesc: string;
    chart: {
      title: string;
      pending: string;
    };
    form: {
      title: string;
      domain: string;
      domainPlaceholder: string;
      localPart: string;
      localPartInvalid: string;
      password: string;
      passwordMin: string;
      quotaMb: string;
      quotaMin: string;
      quotaMax: string;
      quotaRange: string;
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
    backToList: string;
    form: {
      title: string;
      domain: string;
      domainPlaceholder: string;
      localPart: string;
      localPartInvalid: string;
      destination: string;
      destinationPlaceholder: string;
      destinationInvalid: string;
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
    editPage: {
      button: string;
      title: string;
      saved: string;
      saveFailed: string;
      loadFailed: string;
    };
  };
  quotas: {
    alertTitle: string;
    perDomain: string;
    perRecipient: string;
    totalUsed: string;
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
    overviewAlertTitle: string;
    overviewAlertDescription: string;
    editProfile: string;
    editProfileHint: string;
    preferencesHint: string;
    permissionsHint: string;
    editBreadcrumb: string;
    backToProfile: string;
    comingSoonTitle: string;
    soon: string;
    changePassword: string;
    changePasswordHint: string;
    twoFactor: string;
    twoFactorHint: string;
    sessions: string;
    sessionsHint: string;
    auditLog: string;
    auditLogHint: string;
    sessionsPage: {
      breadcrumb: string;
      alertTitle: string;
      alertDescription: string;
      activeTitle: string;
      expiredTitle: string;
      activeEmpty: string;
      deviceOn: string;
      colDevice: string;
      colIp: string;
      colSignedIn: string;
      colEnded: string;
      colStatus: string;
      unknownDevice: string;
      unknownIp: string;
      signedIn: string;
      expires: string;
      active: string;
      online: string;
      lastSeen: string;
      revoked: string;
      expired: string;
      revoke: string;
      empty: string;
      toast: { revoked: string; revokeFailed: string; loadFailed: string };
    };
    identity: string;
    displayName: string;
    displayNameHint: string;
    email: string;
    emailHint: string;
    avatarUrl: string;
    avatarUrlHint: string;
    editAvatar: string;
    phone: string;
    addressSection: string;
    addressLine: string;
    addressComplement: string;
    city: string;
    cityHint: string;
    postalCode: string;
    country: string;
    countryPlaceholder: string;
    coordinates: string;
    coordinatesHint: string;
    coordinatesEmpty: string;
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
    allSessions: {
      label: string;
      hint: string;
      alertTitle: string;
      alertDescription: string;
      activeTitle: string;
      activeEmpty: string;
      expiredTitle: string;
      expiredEmpty: string;
      online: string;
      activeCount: string;
      expiredCount: string;
      colAccount: string;
      colExpired: string;
      colLastSeen: string;
      viewDetails: string;
      toast: {
        loadFailed: string;
        revoked: string;
        revokedAll: string;
        revokeFailed: string;
        purged: string;
        purgeFailed: string;
      };
      detail: {
        activeTitle: string;
        expiredTitle: string;
        revokeAll: string;
        activeCrumb: string;
        expiredCrumb: string;
        purge: string;
        purgeConfirmTitle: string;
        purgeConfirmDescription: string;
      };
    };
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
      byEmail: string;
      byToken: string;
      emailAlertTitle: string;
      emailAlertDescription: string;
      emailLabel: string;
      domainLabel: string;
      domainHint: string;
      domainPlaceholder: string;
      groupsLabel: string;
      groupsHint: string;
      groupsPlaceholder: string;
      ownerSectionTitle: string;
      currentOwnerLabel: string;
      noOwner: string;
      makeOwnerLabel: string;
      makeOwnerHint: string;
      makeOwnerNoRight: string;
      makeOwnerConfirmTitle: string;
      makeOwnerConfirmDescription: string;
      submit: string;
      domainsLoadFailed: string;
      tokenAlertTitle: string;
      tokenAlertDescription: string;
      tokenSoonTitle: string;
      tokenSoonHint: string;
      groupPerms: {
        title: string;
        hint: string;
        switchLabel: string;
        groupLabel: string;
        exists: string;
        willCreate: string;
        permsLabel: string;
        noRight: string;
        saved: string;
        failed: string;
      };
    };
    overviewPage: {
      alertTitle: string;
      alertDescription: string;
      activeCount: string;
      quotaLabel: string;
      ownedDomains: string;
      ownedRecipients: string;
      noDomains: string;
      noRecipients: string;
      stats: { groupsSub: string };
      actions: { edit: string; groups: string };
      toast: { loadFailed: string };
    };
    groupsPage: {
      alertTitle: string;
      alertDescription: string;
      title: string;
      breadcrumb: string;
      pickPlaceholder: string;
      add: string;
      removeTooltip: string;
      empty: string;
    };
    editPage: {
      alertTitle: string;
      alertDescription: string;
      title: string;
      breadcrumb: string;
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
    passwordMin: string;
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
      reserved: string;
      assignable: string;
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
      bayes: {
        title: string;
        noData: string;
        hint: string;
      };
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
    protectedBadge: string;
    memberBadge: string;
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
      protected: string;
      protectedHint: string;
      invisible: string;
      invisibleHint: string;
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
        assignAll: string;
        removeAll: string;
        assignAllDone: string;
        assignAllFailed: string;
        removeAllDone: string;
        removeAllFailed: string;
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
        global: {
          sieve: string;
          rspamd: string;
          postfix: string;
          accounts: string;
          apiTokens: string;
          groups: string;
          domains: string;
          tickets: string;
          superadmin: string;
          domainOwnerElevated: string;
        };
        domain: {
          domain: string;
          recipients: string;
          aliases: string;
          quotas: string;
          rspamd: string;
          admin: string;
          dkim: string;
        };
      };
      actionsLabel: {
        global: {
          sieve: {
            access: string;
            "list-reject-senders": string;
            "create-reject-sender": string;
            "edit-reject-sender": string;
            "delete-reject-sender": string;
          };
          rspamd: {
            access: string;
            "view-rspamd-stats": string;
            "view-rspamd-history": string;
            "view-rspamd-thresholds": string;
            "edit-rspamd-thresholds": string;
            "reset-rspamd-thresholds": string;
          };
          postfix: {
            access: string;
            "view-postfix-queue": string;
          };
          accounts: {
            access: string;
            "list-account-names": string;
            "list-accounts": string;
            "view-account": string;
            "edit-account": string;
            "revoke-account": string;
            "invite-account": string;
            "set-domain-owner": string;
            "view-account-sessions": string;
            "revoke-account-sessions": string;
            "purge-account-sessions": string;
          };
          apiTokens: {
            access: string;
            "list-api-tokens": string;
            "create-api-token": string;
            "edit-api-token": string;
            "revoke-api-token": string;
            "regenerate-api-token": string;
            "delete-api-token": string;
          };
          groups: {
            access: string;
            "list-groups": string;
            "view-group": string;
            "list-group-members": string;
            "create-group": string;
            "edit-group": string;
            "edit-group-global-permissions": string;
            "edit-group-domain-permissions": string;
            "delete-group": string;
            "transfer-group-ownership": string;
            "add-group-member": string;
            "remove-group-member": string;
          };
          domains: {
            access: string;
            "list-all-domains": string;
            "view-disk-usage": string;
            "create-domain": string;
            "view-domain": string;
            "toggle-domain-active": string;
            "transfer-domain-ownership": string;
          };
          tickets: {
            access: string;
            "list-tickets": string;
            "view-ticket": string;
            "create-ticket": string;
            "reply-ticket": string;
            "handle-ticket": string;
            notification: string;
          };
          superadmin: {
            access: string;
            "resize-any-domain-quota": string;
            "delete-any-domain": string;
          };
          domainOwnerElevated: {
            access: string;
            "delete-dkim-key": string;
            "transfer-domain-ownership": string;
          };
        };
        domain: {
          domain: {
            access: string;
            "view-domain": string;
            "toggle-domain-active": string;
            "transfer-domain-ownership": string;
          };
          recipients: {
            access: string;
            "list-recipients": string;
            "view-recipient": string;
            "view-recipient-headroom": string;
            "create-recipient": string;
            "edit-recipient": string;
            "delete-recipient": string;
          };
          aliases: {
            access: string;
            "list-aliases": string;
            "view-alias": string;
            "create-alias": string;
            "edit-alias": string;
            "delete-alias": string;
          };
          quotas: {
            access: string;
            "view-quotas": string;
          };
          rspamd: {
            access: string;
            "view-rspamd-stats": string;
            "view-rspamd-history": string;
          };
          admin: {
            access: string;
            "view-admin-page": string;
            "toggle-domain-active": string;
            "manage-dkim": string;
          };
          dkim: {
            access: string;
            "view-dkim": string;
            "check-dkim-dns": string;
            "rotate-dkim-key": string;
            "delete-dkim-key": string;
          };
        };
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
