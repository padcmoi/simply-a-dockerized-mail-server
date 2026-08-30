// One icon per source, so a machine alert is not read as a ticket at a glance.
const ICONS: Record<string, string> = {
  support: "i-lucide-life-buoy",
  supervision: "i-lucide-activity",
};

export function useNotificationLabel() {
  const { t } = useI18n();

  function label(row: NotificationRow) {
    const p = row.payload ?? {};
    return t(`notifications.event.${row.type}`, {
      subject: p.subject ?? "",
      domain: p.domainName ?? "",
      actor: p.actor ?? t("notifications.someone"),
      status: p.status ? t(`tickets.status.${p.status}`) : "",
      percent: p.percent ?? 0,
    });
  }

  function icon(row: NotificationRow) {
    return ICONS[row.source] ?? "i-lucide-bell";
  }

  function sourceLabel(source: string) {
    const key = `notifications.source.${source}`;
    const translated = t(key);
    return translated === key ? source : translated;
  }

  return { label, icon, sourceLabel };
}
