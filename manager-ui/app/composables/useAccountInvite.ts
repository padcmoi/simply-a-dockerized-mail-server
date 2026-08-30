import { useAuthStore } from "~/stores/auth";

// Inviting an account by email: the form's state, the domain and group options
// it offers, the ownable resources it may attach, and the send itself. The page
// that shows the form was carrying all of this.

export function useAccountInvite() {
  const { t } = useI18n();
  const { call } = useApi();
  const toast = useToast();

  const { groups, load: loadGroups } = useGroups();
  const { isRoot, hasGlobal } = usePermissions();
  const auth = useAuthStore();

  const email = ref("");
  const domainId = ref<number | undefined>(undefined);
  const selectedGroupIds = ref<string[]>([]);
  const makeOwner = ref(false);
  const ownerConfirmOpen = ref(false);
  const useDomainGroup = ref(false);
  const domains = ref<InviteDomainOption[]>([]);
  const sending = ref(false);
  const selectedRecipientIds = ref<number[]>([]);
  const selectedAliasIds = ref<number[]>([]);
  const assignableRecipients = ref<{ id: number; email: string }[]>([]);
  const assignableAliases = ref<{ id: number; source: string; destination: string }[]>([]);

  const canAssignRecipient = computed(() => isRoot.value || hasGlobal("accounts", "assign-recipient-owner"));
  const canAssignAlias = computed(() => isRoot.value || hasGlobal("accounts", "assign-alias-owner"));
  const recipientAssignOptions = computed(() => assignableRecipients.value.map((r) => ({ label: r.email, value: r.id })));
  const aliasAssignOptions = computed(() =>
    assignableAliases.value.map((a) => ({ label: `${a.source} → ${a.destination}`, value: a.id }))
  );
  const domainOptions = computed(() => domains.value.map((d) => ({ label: d.domain, value: d.id })));
  const groupOptions = computed(() => groups.value.filter((g) => !g.isDefault).map((g) => ({ label: g.name, value: g.id })));
  const selectedDomain = computed(() => domains.value.find((d) => d.id === domainId.value) ?? null);
  const currentOwnerEmail = computed(() => selectedDomain.value?.ownerEmail ?? null);
  // Designating an owner takes the same three global actions the API enforces on
  // acceptance: the switch stays visible but is locked when any is missing.
  const canMakeOwner = computed(
    () =>
      isRoot.value ||
      (hasGlobal("accounts", "set-domain-owner") &&
        hasGlobal("domains", "transfer-domain-ownership") &&
        hasGlobal("domain_owner_elevated", "transfer-domain-ownership"))
  );
  const mailEnabled = computed(() => auth.session?.mailEnabled ?? true);
  const canSubmit = computed(() => mailEnabled.value && /.+@.+\..+/.test(email.value) && domainId.value !== undefined);

  watch(domainId, () => {
    makeOwner.value = false;
    useDomainGroup.value = false;
    selectedRecipientIds.value = [];
    selectedAliasIds.value = [];
    void loadAssignable();
  });

  // Existing, unassigned recipients/aliases of the chosen domain the inviter may
  // attach. The account picker route is account-agnostic; the caller's own id
  // satisfies its :id segment, the global assign action gates it.
  async function loadAssignable() {
    const account = auth.session?.accountId;
    if (!account || domainId.value === undefined) {
      assignableRecipients.value = [];
      assignableAliases.value = [];
      return;
    }
    const q = `domainId=${domainId.value}`;
    try {
      if (canAssignRecipient.value) {
        const res = await call<{ items: { id: number; email: string }[] }>(`/accounts/${account}/recipients/assignable?${q}`);
        assignableRecipients.value = res.items;
      }
      if (canAssignAlias.value) {
        const res = await call<{ items: { id: number; source: string; destination: string }[] }>(
          `/accounts/${account}/aliases/assignable?${q}`
        );
        assignableAliases.value = res.items;
      }
    } catch {
      assignableRecipients.value = [];
      assignableAliases.value = [];
    }
  }

  // Turning the switch ON is the sensitive move: it only takes effect once the
  // invitee accepts, so we confirm the deferred transfer before staging it.
  // Turning it OFF needs no confirmation.
  function onToggleOwner(value: boolean) {
    if (value) ownerConfirmOpen.value = true;
    else makeOwner.value = false;
  }

  function confirmOwner() {
    makeOwner.value = true;
  }

  async function loadDomains() {
    try {
      const res = await call<{ items: InviteDomainOption[]; total: number }>("/domains?limit=50&page=1");
      domains.value = res.items;
    } catch (e) {
      toast.add({ title: t("accounts.invite.domainsLoadFailed"), description: (e as Error).message, color: "error" });
    }
  }

  async function submit() {
    if (!canSubmit.value) return;
    sending.value = true;
    try {
      await call("/accounts/invite", {
        method: "POST",
        body: {
          email: email.value,
          domainId: domainId.value,
          groupIds: selectedGroupIds.value,
          makeOwner: makeOwner.value,
          useDomainGroup: useDomainGroup.value,
          recipientIds: canAssignRecipient.value ? selectedRecipientIds.value : [],
          aliasIds: canAssignAlias.value ? selectedAliasIds.value : [],
        },
      });
      toast.add({ title: t("accounts.toast.invited"), color: "success" });
      navigateTo("/admin/accounts");
    } catch (e) {
      toast.add({ title: t("accounts.toast.inviteFailed"), description: (e as Error).message, color: "error" });
    } finally {
      sending.value = false;
    }
  }

  onMounted(() => {
    loadDomains();
    loadGroups();
  });

  return {
    email,
    domainId,
    selectedGroupIds,
    selectedRecipientIds,
    selectedAliasIds,
    makeOwner,
    ownerConfirmOpen,
    useDomainGroup,
    sending,
    canAssignRecipient,
    canAssignAlias,
    recipientAssignOptions,
    aliasAssignOptions,
    domainOptions,
    groupOptions,
    selectedDomain,
    currentOwnerEmail,
    canMakeOwner,
    mailEnabled,
    canSubmit,
    onToggleOwner,
    confirmOwner,
    submit,
    loadGroups,
  };
}
