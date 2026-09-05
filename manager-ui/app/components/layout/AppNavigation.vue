<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { useDomainStore } from "~/stores/domain";

const { open, close } = useSidebar();
const { personalNavItems, adminNavItems, openAdminSections, domainNavItems, userItems } = useNav(onSignOut);

const domainStore = useDomainStore();
const auth = useAuthStore();
const { isOnline } = usePresence();
const route = useRoute();
const { t } = useI18n();
const isMobile = useMediaQuery("(max-width: 1023px)");

// With a domain selected the sidebar folds into two exclusive panels: the
// domain's own menu and the server-wide one (Administration to System). One is
// visible at a time, accordion-style; the panel holding the page on screen is
// opened on navigation, a manual switch stands until the next one. Without a
// selected domain (or on the icon rail) both render as before, no folding.
const accordion = ref<"domain" | "server">("domain");

const userAvatar = computed(() => {
  const url = auth.session?.avatarUrl;
  if (url) return { src: url, alt: auth.session?.displayName ?? auth.session?.email ?? "user" };
  return { alt: auth.session?.displayName ?? auth.session?.email ?? "?" };
});

// The footer avatar is the signed-in account, so it shows the same live
// presence dot as everywhere else. Root is still marked, but by the name badge
// on /profile, not by hijacking this one chip slot.
const presenceChip = computed(() => ({
  color: isOnline(auth.session?.accountId) ? ("success" as const) : ("error" as const),
  position: "bottom-right" as const,
}));

// USidebar switches to a mobile slideover under 1024px (same breakpoint it uses
// internally); clicking a nav link navigates but doesn't close it, so close it
// ourselves on every route change while on mobile. On desktop this would instead
// collapse the sidebar to icon-rail mode, which we don't want, hence the guard.
watch(
  () => route.fullPath,
  () => {
    if (isMobile.value) close();
  }
);

watch(
  () => [route.path, domainStore.selected?.domain] as const,
  ([path, fqdn]) => {
    if (!fqdn) return;
    if (path.startsWith(`/admin/domains/${fqdn}`)) accordion.value = "domain";
    else if (path.startsWith("/admin")) accordion.value = "server";
  },
  { immediate: true }
);

async function onSignOut() {
  await auth.logout();
  await navigateTo("/login");
}
</script>

<template>
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
      <UButton :label="t('app.name')" color="neutral" variant="ghost" square to="/my-space" class="w-full overflow-hidden">
        <template #leading>
          <img src="~/assets/favicon.svg" alt="" width="24" height="24" class="size-6 shrink-0" />
        </template>
      </UButton>
    </template>

    <template #default="{ state }">
      <div class="flex flex-col h-full min-h-0">
        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- On the rail the menu is told it is collapsed rather than left to
               clip its own labels: that is what turns a section into a popover
               of its pages instead of an accordion unfolding inside 3 rem, and
               what gives every icon the tooltip that names it. -->
          <UNavigationMenu
            :key="`personal-${state}`"
            :items="personalNavItems"
            orientation="vertical"
            tooltip
            :collapsed="state === 'collapsed'"
            :ui="{ link: 'p-1.5 overflow-hidden' }"
          />

          <template v-if="domainStore.selected">
            <USeparator class="my-2" />
            <button type="button" class="w-full flex items-center gap-1.5 p-1.5 min-w-0 group" @click="accordion = 'domain'">
              <UIcon name="i-lucide-folder-open" class="text-dimmed shrink-0 size-5" />
              <div v-if="open" class="min-w-0 flex-1 text-left">
                <TruncatedText
                  :text="domainStore.selected.domain"
                  :limit="22"
                  text-class="text-sm font-medium text-muted group-hover:text-default transition-colors"
                />
              </div>
              <UIcon
                v-if="open"
                :name="accordion === 'domain' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="text-dimmed shrink-0 size-4"
              />
            </button>
            <div v-show="accordion === 'domain'" class="mt-1.5">
              <UNavigationMenu
                :key="`domain-${state}`"
                :items="domainNavItems"
                orientation="vertical"
                tooltip
                :collapsed="state === 'collapsed'"
                :ui="{ link: 'p-1.5 overflow-hidden' }"
              />
            </div>

            <USeparator class="my-2" />
            <button type="button" class="w-full flex items-center gap-1.5 p-1.5 group" @click="accordion = 'server'">
              <UIcon name="i-lucide-server" class="text-dimmed shrink-0 size-5" />
              <span
                v-if="open"
                class="text-sm font-medium text-muted group-hover:text-default transition-colors flex-1 text-left truncate"
              >
                {{ t("nav.sectionServer") }}
              </span>
              <UIcon
                v-if="open"
                :name="accordion === 'server' ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="text-dimmed shrink-0 size-4"
              />
            </button>
            <div v-show="accordion === 'server'" class="mt-1.5">
              <UNavigationMenu
                :key="`admin-domain-${state}`"
                v-model="openAdminSections"
                :items="adminNavItems"
                orientation="vertical"
                tooltip
                popover
                :collapsed="state === 'collapsed'"
                :ui="{ link: 'p-1.5 overflow-hidden' }"
              />
            </div>
          </template>

          <template v-else>
            <USeparator class="my-2" />
            <UNavigationMenu
              :key="`admin-${state}`"
              v-model="openAdminSections"
              :items="adminNavItems"
              orientation="vertical"
              tooltip
              popover
              :collapsed="state === 'collapsed'"
              :ui="{ link: 'p-1.5 overflow-hidden' }"
            />
          </template>
        </div>
      </div>
    </template>

    <template #footer>
      <UDropdownMenu
        :items="userItems"
        :content="{ align: 'center', collisionPadding: 12 }"
        :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
      >
        <button
          type="button"
          class="w-full flex items-center gap-2 rounded-md p-1.5 overflow-hidden text-left hover:bg-elevated data-[state=open]:bg-elevated transition-colors"
        >
          <!-- Rail (collapsed) shows only the avatar; expanded shows the full
               UUser (left-aligned, truncating) + the chevron pushed right. -->
          <template v-if="open">
            <UUser
              :name="auth.session?.displayName ?? auth.session?.email ?? 'Account'"
              :description="auth.session?.displayName ? (auth.session?.email ?? undefined) : undefined"
              :avatar="userAvatar"
              :chip="presenceChip"
              size="md"
              class="min-w-0 flex-1"
              :ui="{ root: 'min-w-0', wrapper: 'min-w-0 flex-1 overflow-hidden', name: 'truncate', description: 'truncate' }"
            />
            <UIcon name="i-lucide-chevrons-up-down" class="text-dimmed shrink-0 size-4" />
          </template>
          <UAvatar v-else v-bind="userAvatar" :chip="presenceChip" size="md" class="mx-auto" />
        </button>
      </UDropdownMenu>
    </template>
  </USidebar>
</template>
