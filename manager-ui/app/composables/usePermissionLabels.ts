// Shared between GroupGlobalPermissions and GroupDomainPermissions. Resource
// labels stay 2 fully distinct groups (one per tier), and so do action labels
// now that an action belongs to exactly one resource of one tier: `view-rspamd-stats`
// exists on both tiers and is not the same permission.
//
// Anything missing here falls back to its raw name, so a new server-side
// resource or action never requires a matching frontend release.
export function usePermissionLabels() {
  const { t, te } = useI18n();

  // 2 fully distinct groups, matching GLOBAL_ACTIONS/DOMAIN_ACTIONS in
  // permission-catalog.ts and resources.global/resources.domain in the i18n
  // files -- never merged into one shared object.
  const globalResourceLabels = computed<Record<string, string>>(() => ({
    sieve: t("groups.permissions.resources.global.sieve"),
    rspamd: t("groups.permissions.resources.global.rspamd"),
    postfix: t("groups.permissions.resources.global.postfix"),
    accounts: t("groups.permissions.resources.global.accounts"),
    "api-tokens": t("groups.permissions.resources.global.apiTokens"),
    groups: t("groups.permissions.resources.global.groups"),
    domains: t("groups.permissions.resources.global.domains"),
    superadmin: t("groups.permissions.resources.global.superadmin"),
    domain_owner_elevated: t("groups.permissions.resources.global.domainOwnerElevated"),
  }));

  const domainResourceLabels = computed<Record<string, string>>(() => ({
    domain: t("groups.permissions.resources.domain.domain"),
    recipients: t("groups.permissions.resources.domain.recipients"),
    aliases: t("groups.permissions.resources.domain.aliases"),
    quotas: t("groups.permissions.resources.domain.quotas"),
    rspamd: t("groups.permissions.resources.domain.rspamd"),
    admin: t("groups.permissions.resources.domain.admin"),
    dkim: t("groups.permissions.resources.domain.dkim"),
  }));

  // `api-tokens` carries a dash and `domain_owner_elevated` an underscore, which
  // the locale files cannot declare as a bare key the way vue-i18n splits on dots
  // -- both are camelCased there, and here, exactly like the resource labels above.
  function i18nResourceKey(resource: string) {
    if (resource === "api-tokens") return "apiTokens";
    if (resource === "domain_owner_elevated") return "domainOwnerElevated";
    return resource;
  }

  // `te` guards a dynamic key: an action the server just added shows its raw
  // name rather than an "actions.domain.dkim.whatever" placeholder.
  function actionLabel(tier: "global" | "domain", resource: string, action: string) {
    const key = `groups.permissions.actionsLabel.${tier}.${i18nResourceKey(resource)}.${action}`;
    return te(key) ? t(key) : action;
  }

  function actionLabelsFor(tier: "global" | "domain", resource: string, actions: readonly string[]) {
    return Object.fromEntries(actions.map((action) => [action, actionLabel(tier, resource, action)]));
  }

  return { globalResourceLabels, domainResourceLabels, actionLabel, actionLabelsFor };
}
