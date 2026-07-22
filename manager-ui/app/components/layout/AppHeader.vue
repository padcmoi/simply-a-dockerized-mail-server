<script setup lang="ts">
import { useDomainStore } from "~/stores/domain";

const { toggle } = useSidebar();
const domainStore = useDomainStore();
const route = useRoute();
const { t } = useI18n();

const headerTitle = computed(() => {
  if (route.path.startsWith("/domains/") && domainStore.selected) return domainStore.selected.domain;
  const map: Record<string, string> = {
    "/dashboard": t("nav.dashboard"),
    "/domains": t("nav.domains"),
    "/rspamd": t("nav.rspamd"),
    "/postfix": t("nav.postfix"),
    "/sieve": t("layout.sieveLong"),
    "/accounts": t("nav.accounts"),
    "/groups": t("nav.groups"),
    "/profile": t("layout.profile"),
    "/preferences": t("layout.preferences"),
    "/api-tokens": t("nav.apiTokens"),
  };
  for (const k of Object.keys(map)) if (route.path.startsWith(k)) return map[k];
  return t("app.name");
});
</script>

<template>
  <div class="h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default">
    <UButton icon="i-lucide-panel-left" color="neutral" variant="ghost" :aria-label="t('layout.toggleSidebar')" @click="toggle" />
    <USeparator orientation="vertical" class="h-5" />
    <h1 class="font-semibold truncate">{{ headerTitle }}</h1>
    <div class="ml-auto shrink-0 flex items-center gap-1">
      <HeaderRefreshButton />
      <HeaderNotificationsButton />
    </div>
  </div>
</template>
