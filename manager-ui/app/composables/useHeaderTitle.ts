import { useDomainStore } from "~/stores/domain";

export function useHeaderTitle() {
  const route = useRoute();
  const { t } = useI18n();
  const domainStore = useDomainStore();

  return computed(() => {
    if (route.path.startsWith("/domains/") && domainStore.selected) return domainStore.selected.domain;
    const map: Record<string, string> = {
      "/dashboard": t("nav.dashboard"),
      "/domains": t("nav.domains"),
      "/recipients": t("nav.recipients"),
      "/aliases": t("nav.aliases"),
      "/quotas": t("nav.quotas"),
      "/rspamd": t("nav.rspamd"),
      "/postfix": t("nav.postfix"),
      "/sieve": t("nav.sieveLong"),
      "/accounts": t("nav.accounts"),
      "/groups": t("nav.groups"),
      "/profile": t("nav.profile"),
      "/api-tokens": t("nav.apiTokens"),
    };
    for (const k of Object.keys(map)) if (route.path.startsWith(k)) return map[k];
    return t("app.name");
  });
}
