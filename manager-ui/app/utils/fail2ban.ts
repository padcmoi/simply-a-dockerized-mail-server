type Translate = (key: string, params: Record<string, unknown>) => string;

export function formatSeconds(seconds: number, t: Translate) {
  if (seconds < 0) return "∞";
  if (seconds > 0 && seconds % 86_400 === 0) return t("fail2ban.days", { n: seconds / 86_400 });
  if (seconds > 0 && seconds % 3_600 === 0) return t("fail2ban.hours", { n: seconds / 3_600 });
  if (seconds > 0 && seconds % 60 === 0) return t("fail2ban.minutes", { n: seconds / 60 });
  return t("fail2ban.seconds", { n: seconds });
}

export function formatStamp(ms: number, locale: string) {
  return new Date(ms).toLocaleString(locale.replace(/_/g, "-"));
}
