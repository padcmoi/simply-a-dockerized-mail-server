<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";

const open = ref(true);

const { globalNavItems, domainNavItems, userItems } = useNav(onSignOut);

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

const userAvatar = computed(() => {
  const url = auth.session?.avatarUrl;
  if (url)
    return {
      src: url,
      alt: auth.session?.name ?? auth.session?.username ?? "user",
    };
  return { alt: auth.session?.name ?? auth.session?.username ?? "?" };
});

const rootBadge = computed(() => (auth.session?.isRoot ? { label: t("layout.rootBadge"), color: "warning" as const } : null));

const domainStore = useDomainStore();
const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();
const isMobile = useMediaQuery("(max-width: 1023px)");

// USidebar switches to a mobile slideover under 1024px (same breakpoint it
// uses internally); clicking a nav link navigates but doesn't close it, so
// close it ourselves on every route change while on mobile. On desktop this
// would instead collapse the sidebar to icon-rail mode, which we don't want,
// hence the isMobile guard.
watch(
  () => route.fullPath,
  () => {
    if (isMobile.value) open.value = false;
  }
);

async function onSignOut() {
  await auth.logout();
  await navigateTo("/login");
}

function toggleSidebar() {
  open.value = !open.value;
}

function closeDomain() {
  domainStore.clear();
  navigateTo("/domains");
}
</script>

<template>
  <div class="flex flex-1 min-h-dvh">
    <USidebar
      v-model:open="open"
      collapsible="icon"
      rail
      :ui="{
        container: 'h-full',
        inner: 'bg-elevated/25 divide-transparent',
        body: 'py-0',
      }"
    >
      <template #header>
        <UButton
          icon="i-lucide-mail"
          :label="t('app.name')"
          color="neutral"
          variant="ghost"
          square
          to="/dashboard"
          class="w-full overflow-hidden"
          :ui="{ leadingIcon: 'text-primary' }"
        />
      </template>

      <template #default="{ state }">
        <UNavigationMenu
          :key="`global-${state}`"
          :items="globalNavItems"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />

        <template v-if="domainStore.selected">
          <USeparator class="my-2" />
          <div class="flex items-center gap-1.5 px-1.5 py-1 min-w-0">
            <NuxtLink :to="`/domains/${domainStore.selected.domain}`" class="flex items-center gap-1.5 min-w-0 flex-1 group">
              <UIcon name="i-lucide-folder-open" class="text-primary shrink-0 size-4" />
              <span v-if="open" class="text-xs font-semibold truncate text-muted group-hover:text-primary transition-colors">
                {{ domainStore.selected.domain }}
              </span>
            </NuxtLink>
            <UButton
              v-if="open"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              class="shrink-0"
              @click="closeDomain"
            />
          </div>
          <UNavigationMenu
            :key="`domain-${state}`"
            :items="domainNavItems"
            orientation="vertical"
            :ui="{ link: 'p-1.5 overflow-hidden' }"
          />
        </template>
      </template>

      <template #footer>
        <UDropdownMenu
          :items="userItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            :avatar="userAvatar"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto', label: 'flex items-center gap-1.5 min-w-0' }"
          >
            <span class="truncate min-w-0">{{ auth.session?.name ?? auth.session?.username ?? "Account" }}</span>
            <UBadge v-if="rootBadge" :color="rootBadge.color" variant="subtle" size="xs" class="min-w-0 max-w-24 shrink-0">
              <span class="truncate block">{{ rootBadge.label }}</span>
            </UBadge>
          </UButton>
        </UDropdownMenu>
      </template>
    </USidebar>

    <div class="flex-1 flex flex-col min-w-0">
      <div class="h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default">
        <UButton
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          :aria-label="t('layout.toggleSidebar')"
          @click="toggleSidebar"
        />
        <USeparator orientation="vertical" class="h-5" />
        <h1 class="font-semibold truncate">{{ headerTitle }}</h1>
      </div>

      <BreadcrumbProvider>
        <slot />
      </BreadcrumbProvider>
    </div>
  </div>
</template>
