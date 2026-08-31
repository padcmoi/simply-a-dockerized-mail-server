// Opening a ticket: the form's state, the domain it is about, the mailboxes and
// aliases of that domain it may name, and the creation itself.
//
// The addresses are per domain, so the two selectors only mean anything once a
// domain is chosen and are emptied whenever it changes. Whether naming one is
// mandatory is the server's call, not the form's: it arrives with the addresses
// and gates the submit on exactly the rule POST /tickets enforces.
export function useTicketCreate() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loadingResources = ref(false);
  const form = reactive({
    domainId: undefined as number | undefined,
    subject: "",
    body: "",
    visibility: "private" as "public" | "private",
    recipientIds: [] as number[],
    aliasIds: [] as number[],
  });

  const resources = ref<TicketDomainResources | null>(null);
  const resourcesRequired = computed(() => resources.value?.required ?? true);
  const recipientOptions = computed(() => (resources.value?.recipients ?? []).map((r) => ({ label: r.email, value: r.id })));
  const aliasOptions = computed(() =>
    (resources.value?.aliases ?? []).map((a) => ({ label: `${a.source} -> ${a.destination}`, value: a.id }))
  );
  const hasResourceOptions = computed(() => recipientOptions.value.length > 0 || aliasOptions.value.length > 0);
  const namedSomething = computed(() => form.recipientIds.length > 0 || form.aliasIds.length > 0);
  // A domain with no address at all cannot satisfy the rule, so the rule does
  // not apply to it: refusing every ticket on an empty domain would lock the
  // support desk out of the very domain that needs setting up.
  const resourcesMissing = computed(() => resourcesRequired.value && hasResourceOptions.value && !namedSomething.value);

  const { data: domains, status: domainsStatus } = useAsyncData<DomainOption[]>(
    "tickets-domains",
    () => call<DomainOption[]>("/tickets/domains"),
    { server: false, default: () => [] }
  );
  const loadingDomains = computed(() => domainsStatus.value === "pending");
  const domainOptions = computed(() => (domains.value ?? []).map((d) => ({ value: d.id, label: d.domain })));

  const formInvalid = computed(
    () => !form.domainId || form.subject.trim().length === 0 || form.body.trim().length === 0 || resourcesMissing.value
  );

  async function loadResources() {
    form.recipientIds = [];
    form.aliasIds = [];
    if (form.domainId === undefined) {
      resources.value = null;
      return;
    }
    loadingResources.value = true;
    try {
      resources.value = await call<TicketDomainResources>(`/tickets/domains/${form.domainId}/resources`);
    } catch (err) {
      resources.value = null;
      toast.add({ title: t("tickets.form.resourcesLoadFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      loadingResources.value = false;
    }
  }

  watch(() => form.domainId, loadResources);

  async function create() {
    if (formInvalid.value) return;
    saving.value = true;
    try {
      await call("/tickets", {
        method: "POST",
        body: {
          domainId: form.domainId,
          subject: form.subject.trim(),
          body: form.body.trim(),
          visibility: form.visibility,
          recipientIds: form.recipientIds,
          aliasIds: form.aliasIds,
        },
      });
      toast.add({ title: t("tickets.toast.created"), color: "success" });
      await navigateTo("/admin/tickets");
    } catch (err) {
      toast.add({ title: t("tickets.toast.createFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return {
    form,
    saving,
    loadingDomains,
    loadingResources,
    domainOptions,
    recipientOptions,
    aliasOptions,
    hasResourceOptions,
    resourcesRequired,
    resourcesMissing,
    formInvalid,
    create,
  };
}
