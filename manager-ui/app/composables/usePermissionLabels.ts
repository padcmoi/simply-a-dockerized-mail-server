// Shared between GroupGlobalPermissions and GroupDomainPermissions, but the
// resource labels stay 2 fully distinct groups (one per tier) -- only
// actionLabels is actually the same regardless of tier. A resource with no
// matching key here just falls back to its raw name (see each component's
// template), so a new server-side resource never requires a matching
// frontend release.
export function usePermissionLabels() {
  const { t } = useI18n();

  // 2 fully distinct groups, matching GLOBAL_RESOURCES/DOMAIN_RESOURCES in
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

  const actionLabels = computed<Record<string, string>>(() => ({
    access: t("groups.permissions.actionsLabel.access"),
    read: t("groups.permissions.actionsLabel.read"),
    create: t("groups.permissions.actionsLabel.create"),
    modify: t("groups.permissions.actionsLabel.modify"),
    delete: t("groups.permissions.actionsLabel.delete"),
  }));

  return { globalResourceLabels, domainResourceLabels, actionLabels };
}
