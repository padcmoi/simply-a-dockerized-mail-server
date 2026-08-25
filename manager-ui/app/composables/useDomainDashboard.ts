import type { ChartData, ChartOptions } from "chart.js";

export interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
  ownerId?: number | null;
  ownerEmail?: string | null;
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
  reservedForAccountsBytes: string;
  recipients: { id: number; email: string; bytes: string; quota: string }[];
}
export interface DomainRspamdStats {
  scanned: number;
  actions: { reject: number; greylist: number; "no action": number } & Record<string, number>;
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
export interface DkimCheckResult {
  domain: string;
  hasKeyInDatabase: boolean;
  match: boolean;
  checkedAt: string;
  error: string | null;
  staleSelectorFound: { selector: string; queriedName: string; txtRecord: string } | null;
  expected: { selector: string; queriedName: string; value: string } | null;
  found: { value: string } | null;
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

// How many mailboxes the "fullest mailboxes" chart lists. Kept in step with
// the `{count}` the i18n title interpolates, so the heading can never promise
// more rows than the chart draws.
export const TOP_MAILBOXES = 5;

interface MainData {
  domain: Domain | null;
  recipients: Recipient[];
  aliases: Alias[];
  quota: QuotaDomain | null;
  reservedForAccountsBytes: string;
  topMailboxes: MailboxEntry[];
}

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
  const { tick } = useDataRefresh();

  const domainFqdn = computed(() => String(route.params.domain));

  // Main waterfall: resolve the domain by fqdn, then its recipients/aliases/quota
  // in parallel. `loading` (derived from `status`, see below) drives the
  // page's stat-card/disk/top-mailboxes skeletons.
  const { data: mainData, status: mainStatus } = useAsyncData<MainData>(
    "domain-dashboard-main",
    async () => {
      const domains = await call<Domain[]>("/domains");
      const found = domains.find((d) => d.domain === domainFqdn.value) ?? null;
      if (!found)
        return { domain: null, recipients: [], aliases: [], quota: null, reservedForAccountsBytes: "0", topMailboxes: [] };
      domainStore.select(found);
      const [recs, als, quotaData] = await Promise.all([
        call<Recipient[]>(`/domains/${found.id}/recipients`),
        call<Alias[]>(`/domains/${found.id}/aliases`),
        call<QuotaPayload>(`/domains/${found.id}/quotas`),
      ]);
      const quotaByEmail = new Map(recs.map((r) => [r.email, r.quota]));
      const enriched: MailboxEntry[] = quotaData.recipients.map((q) => ({
        ...q,
        quota: quotaByEmail.get(q.email) ?? "0",
      }));
      const topMailboxes = [...enriched].sort((a, b) => occupancyRate(b) - occupancyRate(a)).slice(0, TOP_MAILBOXES);
      return {
        domain: found,
        recipients: recs,
        aliases: als,
        quota: quotaData.domain,
        reservedForAccountsBytes: quotaData.reservedForAccountsBytes ?? "0",
        topMailboxes,
      };
    },
    {
      server: false,
      watch: [tick],
      default: () => ({
        domain: null,
        recipients: [],
        aliases: [],
        quota: null,
        reservedForAccountsBytes: "0",
        topMailboxes: [],
      }),
    }
  );

  // NOT `pending`: with `server: false`, Nuxt defers the initial fetch to
  // `onBeforeMount`, so `pending` stays false through SSR render AND the gap
  // before that callback fires -- the SSR'd HTML would flash empty content
  // before ever showing a skeleton. `status` starts at "idle" both server-
  // and client-side and only flips once a fetch has genuinely settled.
  const domain = computed(() => mainData.value?.domain ?? null);
  const domainId = computed(() => domain.value?.id ?? null);

  // Realtime overlays: once the domain id resolves, each widget's data follows
  // its domain-scoped topic and falls back to the REST value from the main
  // waterfall above until the first frame (or when a domain-scoped
  // subscription isn't permitted). See the matching watchers.
  const rtRecipients = useRealtimeTopic<Recipient[]>(() => (domainId.value ? `domain-recipients:${domainId.value}` : null));
  const rtAliases = useRealtimeTopic<Alias[]>(() => (domainId.value ? `domain-aliases:${domainId.value}` : null));
  const rtQuota = useRealtimeTopic<QuotaPayload>(() => (domainId.value ? `domain-quota:${domainId.value}` : null));
  const rtRspamd = useRealtimeTopic<DomainRspamdStats>(() => (domainId.value ? `domain-rspamd:${domainId.value}` : null));
  const rtPostfix = useRealtimeTopic<PostfixQueueStats>(() => (domainId.value ? `domain-postfix:${domainId.value}` : null));

  const recipients = computed(() => rtRecipients.value ?? mainData.value?.recipients ?? []);
  const aliases = computed(() => rtAliases.value ?? mainData.value?.aliases ?? []);
  const quota = computed(() => rtQuota.value?.domain ?? mainData.value?.quota ?? null);
  const topMailboxes = computed(() => {
    const wsRecipients = rtQuota.value?.recipients;
    if (wsRecipients) {
      return [...wsRecipients].sort((a, b) => occupancyRate(b) - occupancyRate(a)).slice(0, TOP_MAILBOXES);
    }
    return mainData.value?.topMailboxes ?? [];
  });
  const loading = computed(() => !rtRecipients.value && mainStatus.value !== "success" && mainStatus.value !== "error");

  // `immediate: false`: these three only make sense once `domainId` is known
  // (set once the main waterfall above resolves). Without this, the default
  // on-mount fetch would run immediately with `domainId` still null, resolve
  // straight to "success" with empty data, and flash an empty/no-data state
  // before `watch: [domainId]` fires the real fetch a moment later. Leaving
  // them un-run until `domainId` actually changes avoids that entirely.
  const {
    data: dkimData,
    status: dkimStatus,
    refresh: refreshDkim,
  } = useAsyncData<DkimKey[]>(
    "domain-dashboard-dkim",
    async () => {
      if (!domainId.value) return [];
      try {
        return await call<DkimKey[]>(`/domains/${domainId.value}/dkim`);
      } catch {
        return [];
      }
    },
    { server: false, immediate: false, watch: [domainId, tick], default: () => [] }
  );
  const dkimKeys = computed(() => dkimData.value ?? []);
  const dkimLoading = computed(() => dkimStatus.value !== "success" && dkimStatus.value !== "error");

  // Whether the published DNS TXT record actually matches the DB key, not
  // just whether a key row exists (that's `dkimKeys.length > 0` above) --
  // drives the Administration card's status icon on this dashboard.
  const { data: dkimCheckData, refresh: refreshDkimCheck } = useAsyncData<DkimCheckResult | null>(
    "domain-dashboard-dkim-check",
    async () => {
      if (!domainId.value) return null;
      try {
        return await call<DkimCheckResult>(`/domains/${domainId.value}/dkim-check`);
      } catch {
        return null;
      }
    },
    { server: false, immediate: false, watch: [domainId, tick], default: () => null }
  );
  const dkimCheck = computed(() => dkimCheckData.value);

  const { data: rspamdData } = useAsyncData<RspamdHistoryRow[]>(
    "domain-dashboard-rspamd",
    async () => {
      if (!domainId.value) return [];
      try {
        return await call<RspamdHistoryRow[]>(`/domains/${domainId.value}/rspamd/history?size=200`);
      } catch {
        return [];
      }
    },
    { server: false, immediate: false, watch: [domainId, tick], default: () => [] }
  );
  const rspamdHistory = computed(() => rspamdData.value ?? []);
  // The dashboard's rspamd card needs the per-action tally. It comes from the
  // domain-rspamd topic when subscribed, else is derived from the history rows
  // fetched above (the REST fallback).
  const rspamdStats = computed<DomainRspamdStats>(() => {
    if (rtRspamd.value) return rtRspamd.value;
    const rows = rspamdHistory.value;
    const count = (action: string) => rows.filter((r) => r.action === action).length;
    return {
      scanned: rows.length,
      actions: { reject: count("reject"), greylist: count("greylist"), "no action": count("no action") },
    };
  });

  const { data: postfixData, status: postfixStatus } = useAsyncData<PostfixQueueStats | null>(
    "domain-dashboard-postfix",
    async () => {
      if (!domain.value) return null;
      try {
        return await call<PostfixQueueStats>(`/postfix/queue?domain=${encodeURIComponent(domain.value.domain)}`);
      } catch {
        return null;
      }
    },
    { server: false, immediate: false, watch: [domainId, tick] }
  );
  const postfixQueue = computed(() => rtPostfix.value ?? postfixData.value ?? null);
  const postfixLoading = computed(() => !rtPostfix.value && postfixStatus.value !== "success" && postfixStatus.value !== "error");

  const activeRecipients = computed(() => recipients.value.filter((r) => r.active).length);
  const usedBytes = computed(() => Number(quota.value?.bytes ?? 0));
  const allocatedBytes = computed(() => Number(domain.value?.quota ?? 0));
  const freeBytes = computed(() => (allocatedBytes.value > 0 ? Math.max(0, allocatedBytes.value - usedBytes.value) : 0));
  const isUnlimited = computed(() => allocatedBytes.value === 0);
  const messagesCount = computed(() => Number(quota.value?.messages ?? 0));

  // `used` is what the mailboxes actually hold on disk; `reserved` is what
  // their quotas claim from the domain whether or not a byte was ever written.
  // Only the latter says whether another recipient still fits -- it is the
  // ceiling RecipientsService enforces. `recipients` is the unpaginated list,
  // so this sum covers the whole domain, not a page of it.
  const reservedBytes = computed(() => recipients.value.reduce((sum, r) => sum + Number(r.quota), 0));
  // Quota promised to delegated accounts and not yet spent on a mailbox,
  // pending invitations and open links included: committed against the domain,
  // so it is neither assignable nor double-counted with the mailboxes it will
  // one day become.
  const reservedForAccountsBytes = computed(() => Number(mainData.value?.reservedForAccountsBytes ?? 0));
  const assignableBytes = computed(() =>
    isUnlimited.value ? 0 : Math.max(0, allocatedBytes.value - reservedBytes.value - reservedForAccountsBytes.value)
  );

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
    // The four slices add up to the domain's allocated quota: what mailboxes
    // actually hold (used), what their quotas claim but have not written
    // (reserved), what delegations promise to accounts (reservedForAccounts,
    // pending links included) and what is still free to hand out (assignable).
    // Showing only used-vs-free would suggest space is available when it is in
    // fact already spoken for.
    const reservedUnused = Math.max(0, Math.min(reservedBytes.value, allocatedBytes.value) - usedBytes.value);
    return {
      labels: [
        t("domainDashboard.disk.used"),
        t("domainDashboard.disk.reserved"),
        t("domainDashboard.disk.reservedForAccounts"),
        t("domainDashboard.disk.assignable"),
      ],
      datasets: [
        {
          data: [usedBytes.value, reservedUnused, reservedForAccountsBytes.value, assignableBytes.value],
          backgroundColor: [colors.value.error, colors.value.warning, colors.value.info, colors.value.success],
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
      // Local-part only: every mailbox on this chart belongs to the domain the
      // page is already titled after, so the suffix is 20 identical characters
      // eating the axis. The tooltip still gives the full address.
      labels: mailboxes.map((r) => r.email.split("@")[0]),
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
          // The axis label was trimmed to the local-part, so the full address
          // has to reappear somewhere: the tooltip title is that somewhere.
          title: (items) => topMailboxes.value[items[0]?.dataIndex ?? 0]?.email ?? "",
          label: (ctx) => {
            const m = topMailboxes.value[ctx.dataIndex];
            const bytes = formatBytes(Number(m?.bytes ?? 0));
            if (Number(m?.quota ?? 0) === 0) return ` ${bytes}`;
            return ` ${(ctx.parsed.x ?? 0).toFixed(1)}% (${bytes})`;
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
    setBreadcrumb([{ label: t("nav.domains"), to: "/admin/domains" }, { label: domain.value?.domain ?? "..." }]);
  });

  async function rotateDkim() {
    if (!domain.value) return;
    try {
      await call(`/domains/${domain.value.id}/dkim/rotate`, { method: "POST" });
      await Promise.all([refreshDkim(), refreshDkimCheck()]);
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
    }
  }

  async function deleteDkim(selector: string) {
    if (!domain.value) return;
    try {
      await call(`/domains/${domain.value.id}/dkim/${selector}`, {
        method: "DELETE",
      });
      await Promise.all([refreshDkim(), refreshDkimCheck()]);
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

  return {
    domain,
    recipients,
    aliases,
    topMailboxes,
    dkimKeys,
    dkimCheck,
    rspamdStats,
    postfixQueue,
    loading,
    dkimLoading,
    postfixLoading,
    domainFqdn,
    activeRecipients,
    usedBytes,
    allocatedBytes,
    freeBytes,
    reservedBytes,
    reservedForAccountsBytes,
    assignableBytes,
    isUnlimited,
    messagesCount,
    diskChartData,
    diskChartOptions,
    barChartData,
    barChartOptions,
    barChartHeight,
    rotateDkim,
    deleteDkim,
    copyToClipboard,
  };
}
