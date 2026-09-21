export function useDmarcAccess() {
  const { isRoot, hasGlobal } = usePermissions();
  const can = (action: string) => computed(() => isRoot.value || (hasGlobal("dmarc", "access") && hasGlobal("dmarc", action)));
  return {
    canView: can("view-dmarc-reports"),
    canSend: can("send-dmarc-reports"),
    canImport: can("import-dmarc-reports"),
    canManage: can("manage-dmarc-settings"),
  };
}

export function useDmarcActions() {
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const { t } = useI18n();
  const busy = ref<"run" | "scan" | number | null>(null);

  async function run() {
    busy.value = "run";
    try {
      const summary = await call<DmarcRunSummary>("/dmarc/outgoing/run", { method: "POST", body: {} });
      toast.add({ title: t("dmarc.overview.runDone", { ...summary }), color: "success" });
      return summary;
    } catch (e) {
      toast.add({ title: t("dmarc.overview.runFailed"), description: apiErrorMessage(e), color: "error" });
      return null;
    } finally {
      busy.value = null;
    }
  }

  async function scan() {
    busy.value = "scan";
    try {
      const summary = await call<DmarcScanSummary>("/dmarc/inbox/scan", { method: "POST" });
      toast.add({ title: t("dmarc.overview.scanDone", { ...summary }), color: "success" });
      return summary;
    } catch (e) {
      toast.add({ title: t("dmarc.overview.scanFailed"), description: apiErrorMessage(e), color: "error" });
      return null;
    } finally {
      busy.value = null;
    }
  }

  async function retry(id: number) {
    busy.value = id;
    try {
      const row = await call<DmarcOutgoingReport>(`/dmarc/outgoing/${id}/retry`, { method: "POST" });
      toast.add({
        title: t(row.status === "sent" ? "dmarc.sent.retried" : "dmarc.sent.retryFailed"),
        color: row.status === "sent" ? "success" : "warning",
      });
      return row;
    } catch (e) {
      toast.add({ title: t("dmarc.sent.retryFailed"), description: apiErrorMessage(e), color: "error" });
      return null;
    } finally {
      busy.value = null;
    }
  }

  async function download(kind: "incoming" | "outgoing", id: number) {
    try {
      const file = await call<DmarcXml>(`/dmarc/${kind}/${id}/xml`);
      const url = URL.createObjectURL(new Blob([file.xml], { type: "application/xml" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.add({ title: t("common.failed"), description: apiErrorMessage(e), color: "error" });
    }
  }

  return { busy, run, scan, retry, download };
}

export function useDmarcFormat() {
  const { t, locale } = useI18n();
  const tag = computed(() => locale.value.replace("_", "-"));

  function day(epochSeconds: number) {
    return new Date(epochSeconds * 1000).toLocaleDateString(tag.value, {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function period(begin: number, end: number) {
    const from = day(begin);
    const to = day(end);
    return from === to ? from : `${from} - ${to}`;
  }

  function rate(part: number, whole: number) {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
  }

  function when(epochMs: number | null) {
    return epochMs === null ? t("dmarc.overview.never") : new Date(epochMs).toLocaleString(tag.value);
  }

  function count(value: number) {
    return value.toLocaleString(tag.value);
  }

  return { day, period, rate, when, count };
}

export function useDmarcDomains() {
  const { call } = useApi();
  const { data } = useAsyncData("dmarc-domains", () => call<DmarcOverview>("/dmarc/overview"), {
    server: false,
    default: () => null,
  });
  return { hosted: computed(() => data.value?.hostedDomains ?? []) };
}

export function useDomainDmarcRecord(domainId: () => number | null) {
  const { call } = useApi();
  return useAsyncData(
    () => `domain-dmarc-record-${domainId() ?? "none"}`,
    () => {
      const id = domainId();
      return id ? call<DmarcRecord>(`/domains/${id}/dmarc-record`) : Promise.resolve(null);
    },
    { server: false, watch: [domainId] }
  );
}
