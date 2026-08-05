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

async function onSignOut() {
  await auth.logout();
  await navigateTo("/login");
}

function closeDomain() {
  domainStore.clear();
  navigateTo("/admin/domains");
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
      <UButton
        icon="i-lucide-mail"
        :label="t('app.name')"
        color="neutral"
        variant="ghost"
        square
        to="/my-space"
        class="w-full overflow-hidden"
        :ui="{ leadingIcon: 'text-primary' }"
      />
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
            <div class="flex items-center gap-1.5 px-1.5 py-1 min-w-0">
              <NuxtLink
                :to="`/admin/domains/${domainStore.selected.domain}`"
                class="flex items-center gap-1.5 min-w-0 flex-1 group"
              >
                <UIcon name="i-lucide-folder-open" class="text-primary shrink-0 size-4" />
                <div v-if="open" class="min-w-0 flex-1">
                  <TruncatedText
                    :text="domainStore.selected.domain"
                    :limit="22"
                    text-class="text-xs font-semibold text-muted group-hover:text-primary transition-colors"
                  />
                </div>
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
            <div :class="open ? 'ml-3 border-l border-default pl-1.5' : ''">
              <UNavigationMenu
                :key="`domain-${state}`"
                :items="domainNavItems"
                orientation="vertical"
                tooltip
                :collapsed="state === 'collapsed'"
                :ui="{ link: 'p-1.5 overflow-hidden' }"
              />
            </div>
          </template>
        </div>

        <div class="shrink-0">
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
