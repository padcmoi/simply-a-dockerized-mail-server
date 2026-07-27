<script setup lang="ts">
import { useDomainStore } from "~/stores/domain";

const { toggle } = useSidebar();
const domainStore = useDomainStore();
const route = useRoute();
const { t } = useI18n();

const headerTitle = computed(() => {
  if (route.path.startsWith("/admin/domains/") && domainStore.selected) return domainStore.selected.domain;
  const map: Record<string, string> = {
    "/admin/domains": t("nav.domains"),
    "/admin/rspamd": t("nav.rspamd"),
    "/admin/postfix": t("nav.postfix"),
    "/admin/sieve": t("layout.sieveLong"),
    "/admin/accounts": t("nav.accounts"),
    "/admin/groups": t("nav.groups"),
    "/admin/tickets": t("nav.tickets"),
    "/admin/api-tokens": t("nav.apiTokens"),
    "/admin/config": t("nav.config"),
    "/my-space": t("nav.myspace"),
    "/profile": t("layout.profile"),
    "/preferences": t("layout.preferences"),
    "/admin": t("nav.administration"),
  };
  for (const k of Object.keys(map)) {
    const label = map[k];
    if (label && route.path.startsWith(k)) return label;
  }
  return t("app.name");
});
</script>

<template>
  <div class="h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default">
    <UButton icon="i-lucide-panel-left" color="neutral" variant="ghost" :aria-label="t('layout.toggleSidebar')" @click="toggle" />
    <USeparator orientation="vertical" class="h-5" />
    <TruncatedText :text="headerTitle" :limit="40" text-class="font-semibold" />
    <div class="ml-auto shrink-0 flex items-center gap-1">
      <HeaderRefreshButton />
      <HeaderNotificationsButton />
    </div>
  </div>
</template>
