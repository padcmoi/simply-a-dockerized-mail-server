import { convertZoneTime, viewerZone } from "~/utils/zoneTime";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const OFFSITE = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:\/[A-Za-z0-9._/-]*$/;
const POLL_MS = 5000;
const POLL_ROUNDS = 30;

export function useBackupConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const overview = ref<BackupOverview | null>(null);
  const form = reactive<BackupConfigForm>({ time: "02:30", keepDays: 5, offsite: "", offsiteDeleteLocal: true });
  const zone = viewerZone();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const configured = computed(() => overview.value?.configured === true);
  const serverZone = computed(() => overview.value?.config?.timezone || "UTC");
  const serverTime = computed(() => convertZoneTime(form.time, zone, serverZone.value));
  const pending = computed(() => overview.value?.pending === true);
  const timeError = computed(() => (TIME.test(form.time) ? undefined : t("backups.config.timeInvalid")));
  const keepDaysError = computed(() =>
    Number.isInteger(form.keepDays) && form.keepDays >= 1 && form.keepDays <= 999
      ? undefined
      : t("backups.config.keepDaysInvalid")
  );
  const offsiteError = computed(() => {
    const value = form.offsite.trim();
    return value === "" || OFFSITE.test(value) ? undefined : t("backups.config.offsiteInvalid");
  });
  const dirty = computed(() => {
    const current = overview.value?.config;
    if (!current) return false;
    return (
      serverTime.value !== current.time ||
      form.keepDays !== current.keepDays ||
      form.offsite.trim() !== current.offsite ||
      form.offsiteDeleteLocal !== current.offsiteDeleteLocal
    );
  });
  const valid = computed(() => !timeError.value && !keepDaysError.value && !offsiteError.value && dirty.value && !pending.value);

  function fill(state: BackupOverview) {
    overview.value = state;
    if (!state.config || state.pending) return;
    form.time = convertZoneTime(state.config.time, state.config.timezone || "UTC", zone);
    form.keepDays = state.config.keepDays;
    form.offsite = state.config.offsite;
    form.offsiteDeleteLocal = state.config.offsiteDeleteLocal;
  }

  function stopPolling() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function poll(round = 0) {
    stopPolling();
    if (!pending.value || round >= POLL_ROUNDS) return;
    timer = setTimeout(async () => {
      try {
        fill(await call<BackupOverview>("/backups"));
      } catch {
        return;
      }
      poll(round + 1);
    }, POLL_MS);
  }

  async function load() {
    try {
      fill(await call<BackupOverview>("/backups"));
      poll();
    } catch {
      toast.add({ title: t("backups.config.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      const state = await call<BackupOverview>("/backups/config", {
        method: "PUT",
        body: {
          time: serverTime.value,
          keepDays: form.keepDays,
          offsite: form.offsite.trim(),
          offsiteDeleteLocal: form.offsiteDeleteLocal,
        },
      });
      overview.value = { ...(overview.value as BackupOverview), ...state };
      toast.add({ title: t("backups.config.requested"), color: "success", icon: "i-lucide-check" });
      poll();
    } catch (err) {
      toast.add({ title: t("backups.config.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  onBeforeUnmount(stopPolling);

  return {
    saving,
    loaded,
    overview,
    form,
    zone,
    serverZone,
    serverTime,
    configured,
    pending,
    timeError,
    keepDaysError,
    offsiteError,
    valid,
    load,
    save,
  };
}
