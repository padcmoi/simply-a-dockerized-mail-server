// The sentence and the icon of one journal line. The sentence comes from
// `activity.event.<action>` with the object's label interpolated, so "replied
// to ticket {label}" reads as a sentence; an action the interface has not
// caught up with shows its raw name rather than a placeholder key.
const ICONS: [prefix: string, icon: string][] = [
  ["auth.login.refused", "i-lucide-shield-alert"],
  ["auth.two-factor", "i-lucide-smartphone"],
  ["auth.login", "i-lucide-log-in"],
  ["auth.logout", "i-lucide-log-out"],
  ["auth.session", "i-lucide-monitor-off"],
  ["auth.password", "i-lucide-key-round"],
  ["auth.email", "i-lucide-mail"],
  ["profile", "i-lucide-user-cog"],
  ["accounts", "i-lucide-users"],
  ["recipients", "i-lucide-mailbox"],
  ["aliases", "i-lucide-share-2"],
  ["tickets", "i-lucide-life-buoy"],
  ["api-tokens", "i-lucide-key"],
  ["delegations", "i-lucide-user-plus"],
];

// A dot is a path separator for vue-i18n, so the action's dots are written as
// underscores in the locale files and looked up the same way here.
function keyOf(action: string) {
  return action.replace(/\./g, "_");
}

export function useActivityLabel() {
  const { t, te } = useI18n();

  function label(row: ActivityRow) {
    const key = `activity.event.${keyOf(row.action)}`;
    if (!te(key)) return row.action;
    const details = row.details ?? {};
    return t(key, {
      label: row.entityLabel ?? "",
      status:
        typeof details.status === "string" && te(`tickets.status.${details.status}`) ? t(`tickets.status.${details.status}`) : "",
      fields: Array.isArray(details.fields) ? details.fields.join(", ") : "",
      email: typeof details.email === "string" ? details.email : "",
    });
  }

  // The short name of a kind of event, for the filter's list.
  function actionLabel(action: string) {
    const key = `activity.action.${keyOf(action)}`;
    return te(key) ? t(key) : action;
  }

  function icon(action: string) {
    return ICONS.find(([prefix]) => action.startsWith(prefix))?.[1] ?? "i-lucide-circle-dot";
  }

  return { label, actionLabel, icon };
}
