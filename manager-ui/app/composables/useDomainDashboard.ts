import type { ChartData, ChartOptions } from "chart.js";

export interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
}
export interface Recipient {
  id: number;
  active: number;
  email: string;
  quota: string;
}
export interface Alias {
  id: number;
}
export interface QuotaDomain {
  bytes: string;
  messages: string;
  lastActivity: string;
}
export interface QuotaPayload {
  domain: QuotaDomain | null;
  recipients: { id: number; email: string; bytes: string }[];
}
export interface MailboxEntry {
  id: number;
  email: string;
  bytes: string;
  quota: string;
}
export interface DkimKey {
  domain: string;
  selector: string;
  dnsName: string;
  txtRecord: string;
}
export interface RspamdHistoryRow {
  "message-id": string;
  ip: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  unix_time: number;
  sender_smtp: string;
  rcpt_smtp: string[];
  subject: string;
}
export interface QueueDirStats {
  active: number;
  deferred: number;
  hold: number;
  incoming: number;
}
export interface PostfixQueueStats {
  total: QueueDirStats;
  domain?: QueueDirStats;
  available: boolean;
}

export const REFRESH_OPTIONS = [0, 15, 30, 60] as const;
const REFRESH_STORAGE_KEY = "mail-manager:domain-refresh-interval";

function occupancyRate(m: MailboxEntry) {
  const q = Number(m.quota);
  return q > 0 ? Number(m.bytes) / q : -1;
}

export function useDomainDashboard() {
  const route = useRoute();
  const { call } = useApi();
  const { t } = useI18n();
  const domainStore = useDomainStore();
  const { set: setBreadcrumb } = useBreadcrumb();
  const toast = useToast();
  const { colors } = useChartColors();

  const domain = ref<Domain | null>(null);
  const recipients = ref<Recipient[]>([]);
  const aliases = ref<Alias[]>([]);
  const quota = ref<QuotaDomain | null>(null);
  const topMailboxes = ref<MailboxEntry[]>([]);
  const dkimKeys = ref<DkimKey[]>([]);
  const rspamdHistory = ref<RspamdHistoryRow[]>([]);
  const postfixQueue = ref<PostfixQueueStats | null>(null);
  const loading = ref(false);
  const dkimLoading = ref(false);
  const refreshInterval = ref<number>(0);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const domainFqdn = computed(() => String(route.params.domain));
  const activeRecipients = computed(() => recipients.value.filter((r) => r.active).length);
  const usedBytes = computed(() => Number(quota.value?.bytes ?? 0));
  const allocatedBytes = computed(() => Number(domain.value?.quota ?? 0));
  const freeBytes = computed(() => (allocatedBytes.value > 0 ? Math.max(0, allocatedBytes.value - usedBytes.value) : 0));
  const isUnlimited = computed(() => allocatedBytes.value === 0);
  const messagesCount = computed(() => Number(quota.value?.messages ?? 0));

  const diskChartData = computed<ChartData<"doughnut">>(() => {
    if (isUnlimited.value) {
      return {
        labels: [t("domainDashboard.disk.used")],
        datasets: [
          {
            data: [usedBytes.value || 1],
            backgroundColor: [colors.value.primary],
            borderWidth: 0,
          },
        ],
      };
    }
    return {
      labels: [t("domainDashboard.disk.used"), t("domainDashboard.disk.free")],
      datasets: [
        {
          data: [usedBytes.value, freeBytes.value],
          backgroundColor: [colors.value.error, colors.value.success],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  });

  const diskChartOptions = computed<ChartOptions<"doughnut">>(() => ({
    responsive: true,
    maintainAspectRatio: true,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${formatBytes(ctx.parsed)}` } },
    },
  }));

  const barChartData = computed<ChartData<"bar">>(() => {
    const mailboxes = topMailboxes.value;
    return {
      labels: mailboxes.map((r) => r.email),
      datasets: [
        {
          data: mailboxes.map((r) => {
            const q = Number(r.quota);
            return q === 0 ? 0 : Math.min(100, (Number(r.bytes) / q) * 100);
          }),
          backgroundColor: mailboxes.map((r) => {
            const rate = occupancyRate(r);
            if (rate > 0.9) return colors.value.errorBg;
            if (rate > 0.7) return colors.value.warningBg;
            return colors.value.primaryBg;
          }),
          borderColor: mailboxes.map((r) => {
            const rate = occupancyRate(r);
            if (rate > 0.9) return colors.value.error;
            if (rate > 0.7) return colors.value.warning;
            return colors.value.primary;
          }),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  });

  const barChartOptions = computed<ChartOptions<"bar">>(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const m = topMailboxes.value[ctx.dataIndex];
            const bytes = formatBytes(Number(m?.bytes ?? 0));
            if (Number(m?.quota ?? 0) === 0) return ` ${bytes}`;
            return ` ${(ctx.parsed.x ?? 0).toFixed(1)}% — ${bytes}`;
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: { color: colors.value.gridLine },
        ticks: { color: colors.value.textMuted, callback: (v) => `${v}%` },
      },
      y: {
        grid: { display: false },
        ticks: { color: colors.value.textMuted, font: { size: 11 } },
      },
    },
  }));

  const barChartHeight = computed(() => Math.max(160, topMailboxes.value.length * 36));

  watchEffect(() => {
    setBreadcrumb([{ label: t("nav.domains"), to: "/domains" }, { label: domain.value?.domain ?? "..." }]);
  });

  watch(refreshInterval, (val) => {
    localStorage.setItem(REFRESH_STORAGE_KEY, String(val));
    startAutoRefresh();
  });

  function stopAutoRefresh() {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (refreshInterval.value > 0) refreshTimer = setInterval(load, refreshInterval.value * 1_000);
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") load();
  }

  async function load() {
    if (loading.value) return;
    loading.value = true;
    try {
      const domains = await call<Domain[]>("/domains");
      const found = domains.find((d) => d.domain === domainFqdn.value) ?? null;
      domain.value = found;
      if (!found) return;
      domainStore.select(found);
      const [recs, als, quotaData] = await Promise.all([
        call<Recipient[]>(`/domains/${found.id}/recipients`),
        call<Alias[]>(`/domains/${found.id}/aliases`),
        call<QuotaPayload>(`/domains/${found.id}/quotas`),
      ]);
      recipients.value = recs;
      aliases.value = als;
      quota.value = quotaData.domain;
      const quotaByEmail = new Map(recs.map((r) => [r.email, r.quota]));
      const enriched: MailboxEntry[] = quotaData.recipients.map((q) => ({
        ...q,
        quota: quotaByEmail.get(q.email) ?? "0",
      }));
      topMailboxes.value = [...enriched].sort((a, b) => occupancyRate(b) - occupancyRate(a)).slice(0, 10);
      await Promise.all([loadDkim(found.id), loadRspamdHistory(found.id), loadPostfixQueue(found.domain)]);
    } finally {
      loading.value = false;
    }
  }

  async function loadRspamdHistory(domainId: number) {
    try {
      rspamdHistory.value = await call<RspamdHistoryRow[]>(`/domains/${domainId}/spamd/history?size=200`);
    } catch {
      rspamdHistory.value = [];
    }
  }

  async function loadPostfixQueue(fqdn: string) {
    try {
      postfixQueue.value = await call<PostfixQueueStats>(`/postfix/queue?domain=${encodeURIComponent(fqdn)}`);
    } catch {
      postfixQueue.value = null;
    }
  }

  async function loadDkim(id: number) {
    dkimLoading.value = true;
    try {
      dkimKeys.value = await call<DkimKey[]>(`/domains/${id}/dkim`);
    } catch {
      dkimKeys.value = [];
    } finally {
      dkimLoading.value = false;
    }
  }

  async function rotateDkim() {
    if (!domain.value) return;
    dkimLoading.value = true;
    try {
      await call(`/domains/${domain.value.id}/dkim/rotate`, { method: "POST" });
      await loadDkim(domain.value.id);
      toast.add({
        title: t("domainDashboard.dkim.toast.rotated"),
        color: "success",
      });
    } catch (err) {
      toast.add({
        title: t("domainDashboard.dkim.toast.rotateFailed"),
        description: (err as Error).message,
        color: "error",
      });
    } finally {
      dkimLoading.value = false;
    }
  }

  async function deleteDkim(selector: string) {
    if (!domain.value) return;
    try {
      await call(`/domains/${domain.value.id}/dkim/${selector}`, {
        method: "DELETE",
      });
      await loadDkim(domain.value.id);
      toast.add({
        title: t("domainDashboard.dkim.toast.deleted"),
        color: "success",
      });
    } catch (err) {
      toast.add({
        title: t("domainDashboard.dkim.toast.deleteFailed"),
        description: (err as Error).message,
        color: "error",
      });
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    toast.add({
      title: t("domainDashboard.dkim.copied"),
      icon: "i-lucide-copy",
      color: "success",
      duration: 1500,
    });
  }

  onMounted(() => {
    const saved = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (saved !== null) {
      const v = parseInt(saved, 10);
      if ((REFRESH_OPTIONS as readonly number[]).includes(v)) refreshInterval.value = v;
    }
    startAutoRefresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    load();
  });

  onUnmounted(() => {
    stopAutoRefresh();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return {
    REFRESH_OPTIONS,
    domain,
    recipients,
    aliases,
    topMailboxes,
    dkimKeys,
    rspamdHistory,
    postfixQueue,
    loading,
    dkimLoading,
    refreshInterval,
    domainFqdn,
    activeRecipients,
    usedBytes,
    allocatedBytes,
    freeBytes,
    isUnlimited,
    messagesCount,
    diskChartData,
    diskChartOptions,
    barChartData,
    barChartOptions,
    barChartHeight,
    load,
    rotateDkim,
    deleteDkim,
    copyToClipboard,
  };
}
