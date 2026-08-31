// The administration dashboard's figures: the websocket summary when the server
// pushes one, the REST fan-out rebuilt into the same shape otherwise, and the
// small lists and stat tiles the page draws from either.

export function useAdminDashboard() {
  const { t } = useI18n();
  const { call } = useApi();
  const { tick } = useDataRefresh();

  const summary = useRealtimeTopic<DashboardSummary>("dashboard");

  const { data, status } = useAsyncData<DashboardData>(
    "dashboard-main",
    async () => {
      const [domainList, rejectList, diskData] = await Promise.all([
        call<DashboardDomain[]>("/domains").catch(() => [] as DashboardDomain[]),
        call<DashboardReject[]>("/sieve/reject-senders").catch(() => [] as DashboardReject[]),
        call<DomainDisk>("/domains/disk").catch(() => null),
      ]);

      const [recs, als] = await Promise.all([
        Promise.all(
          domainList.map((d) => call<DashboardRecipient[]>(`/domains/${d.id}/recipients`).catch(() => [] as DashboardRecipient[]))
        ),
        Promise.all(domainList.map((d) => call<OwnedAlias[]>(`/domains/${d.id}/aliases`).catch(() => [] as OwnedAlias[]))),
      ]);

      return { domains: domainList, recipients: recs.flat(), aliases: als.flat(), rejects: rejectList, disk: diskData };
    },
    {
      server: false,
      watch: [tick],
      default: () => ({ domains: [], recipients: [], aliases: [], rejects: [], disk: null }),
    }
  );

  // Same shape as the WS summary, rebuilt from the REST fan-out, so the template
  // reads one `view` object regardless of source (WS when available, REST else).
  const restSummary = computed<DashboardSummary>(() => {
    const domains = data.value?.domains ?? [];
    const recipients = data.value?.recipients ?? [];
    return {
      domains: { total: domains.length, active: domains.filter((d) => d.active).length },
      recipients: { total: recipients.length, active: recipients.filter((r) => r.active).length },
      aliases: { total: (data.value?.aliases ?? []).length },
      blockedSenders: {
        total: (data.value?.rejects ?? []).length,
        enabled: (data.value?.rejects ?? []).filter((r) => r.enabled).length,
      },
      disk: data.value?.disk ?? null,
      recipientsPerDomain: domains
        .map((d) => ({ domain: d.domain, count: recipients.filter((r) => r.domain === d.domain).length }))
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      recentDomains: [...domains]
        .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
        .slice(0, 5)
        .map((d) => ({ id: d.id, domain: d.domain, quota: d.quota, active: d.active })),
      recentRecipients: [...recipients]
        .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
        .slice(0, 6)
        .map((r) => ({ id: r.id, email: r.email, domain: r.domain, active: r.active })),
    };
  });

  const view = computed(() => summary.value ?? restSummary.value);
  const disk = computed(() => view.value.disk);
  const loading = computed(() => !summary.value && status.value !== "success" && status.value !== "error");

  const stats = computed(() => [
    {
      key: "domains",
      label: t("dashboard.stats.domains"),
      value: view.value.domains.total,
      sub: t("dashboard.stats.activeCount", { count: view.value.domains.active }),
      icon: "i-lucide-globe",
      color: "primary",
      to: "/admin/domains",
    },
    {
      key: "recipients",
      label: t("dashboard.stats.recipients"),
      value: view.value.recipients.total,
      sub: t("dashboard.stats.activeCount", { count: view.value.recipients.active }),
      icon: "i-lucide-users",
      color: "info",
      // Aggregated across every domain -- no single nested route to point at,
      // so this (like the "aliases" stat below) links to the domain picker
      // instead of a specific /domains/:domain/recipients.
      to: "/admin/domains",
    },
    {
      key: "aliases",
      label: t("dashboard.stats.aliases"),
      value: view.value.aliases.total,
      sub: t("dashboard.stats.forwarders"),
      icon: "i-lucide-at-sign",
      color: "success",
      to: "/admin/domains",
    },
    {
      key: "rejects",
      label: t("dashboard.stats.blockedSenders"),
      value: view.value.blockedSenders.total,
      sub: t("dashboard.stats.enabledCount", { count: view.value.blockedSenders.enabled }),
      icon: "i-lucide-shield-x",
      color: "warning",
      to: "/admin/sieve",
    },
  ]);

  const recentDomains = computed(() => view.value.recentDomains);
  const recentRecipients = computed(() => view.value.recentRecipients);
  const recipientsPerDomain = computed(() => view.value.recipientsPerDomain);

  return { stats, disk, loading, recentDomains, recentRecipients, recipientsPerDomain };
}
