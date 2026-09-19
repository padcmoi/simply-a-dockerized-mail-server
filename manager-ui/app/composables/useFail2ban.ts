const MANAGER_JAIL = "manager";

export function useFail2ban() {
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const { t } = useI18n();

  const status = shallowRef<Fail2banStatus | null>(null);
  const failed = ref(false);
  const busy = ref<string | null>(null);

  async function load() {
    try {
      status.value = await call<Fail2banStatus>("/fail2ban/jails");
      failed.value = false;
    } catch {
      failed.value = true;
    }
  }

  async function change(verb: "ban" | "unban", jail: string, ip: string) {
    busy.value = `${verb}:${jail}:${ip}`;
    try {
      const path = verb === "ban" ? "/fail2ban/ban" : `/fail2ban/jails/${encodeURIComponent(jail)}/unban`;
      await call<Fail2banJail>(path, { method: "POST", body: { ip } });
      await load();
      toast.add({ title: t(verb === "ban" ? "fail2ban.banned" : "fail2ban.unbanned", { ip, jail }), color: "success" });
      return true;
    } catch (e) {
      toast.add({
        title: t(verb === "ban" ? "fail2ban.banFailed" : "fail2ban.unbanFailed"),
        description: apiErrorMessage(e),
        color: "error",
      });
      return false;
    } finally {
      busy.value = null;
    }
  }

  const frame = useRealtimeTopic<Fail2banStatus>("fail2ban");

  watch(frame, (next) => {
    if (next) status.value = next;
  });
  watch(useDataRefresh().tick, () => void load());

  onMounted(() => void load());

  onScopeDispose(() => {
    status.value = null;
  });

  return {
    status,
    failed,
    busy,
    ban: (ip: string) => change("ban", MANAGER_JAIL, ip),
    unban: (jail: string, ip: string) => change("unban", jail, ip),
  };
}
