// Shared between GroupGlobalPermissions and GroupDomainPermissions -- same
// resource/action i18n labels regardless of which tier is being edited. A
// resource with no matching key here just falls back to its raw name (see
// each component's template), so a new server-side resource never requires
// a matching frontend release.
export function usePermissionLabels() {
  const { t } = useI18n();

  const resourceLabels = computed<Record<string, string>>(() => ({
    sieve: t("groups.permissions.resources.sieve"),
    rspamd: t("groups.permissions.resources.rspamd"),
    postfix: t("groups.permissions.resources.postfix"),
    accounts: t("groups.permissions.resources.accounts"),
    "api-tokens": t("groups.permissions.resources.apiTokens"),
    groups: t("groups.permissions.resources.groups"),
    domains: t("groups.permissions.resources.domains"),
    domain: t("groups.permissions.resources.domain"),
    recipients: t("groups.permissions.resources.recipients"),
    aliases: t("groups.permissions.resources.aliases"),
    quotas: t("groups.permissions.resources.quotas"),
    dkim: t("groups.permissions.resources.dkim"),
    admin: t("groups.permissions.resources.admin"),
  }));

  const actionLabels = computed<Record<string, string>>(() => ({
    access: t("groups.permissions.actionsLabel.access"),
    read: t("groups.permissions.actionsLabel.read"),
    create: t("groups.permissions.actionsLabel.create"),
    modify: t("groups.permissions.actionsLabel.modify"),
    delete: t("groups.permissions.actionsLabel.delete"),
  }));

  return { resourceLabels, actionLabels };
}
