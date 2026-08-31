// The server-wide switch behind the mandatory mailbox/alias on a new ticket.
// Root only, like every /config route: the creation form reads the same flag
// from its own resources call, which any account allowed to open a ticket may
// make.
export function useTicketsConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const required = ref(true);

  async function load() {
    try {
      const data = await call<{ ticketResourcesRequired: boolean }>("/config/tickets");
      required.value = data.ticketResourcesRequired;
    } catch {
      toast.add({ title: t("config.tickets.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    saving.value = true;
    try {
      await call("/config/tickets", { method: "PUT", body: { ticketResourcesRequired: required.value } });
      toast.add({ title: t("config.tickets.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.tickets.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, required, load, save };
}
