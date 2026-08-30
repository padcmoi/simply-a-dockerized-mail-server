<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({});

const { t } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

const permModalOpen = ref(false);
const effectiveModalOpen = ref(false);
const selectedGroup = ref<{ id: string; name: string } | null>(null);
const ownedDomains = ref<OwnedDomain[]>([]);
const ownedRecipients = ref<OwnedRecipientSummary[]>([]);

const { isOnline } = usePresence();
const avatarAlt = computed(() => auth.session?.displayName || auth.session?.email || "?");
// Sections not built yet, surfaced as disabled cards so the roadmap is visible.
const comingSoon = computed(() => [
  { icon: "i-lucide-key-round", label: t("profile.changePassword"), hint: t("profile.changePasswordHint") },
  { icon: "i-lucide-smartphone", label: t("profile.twoFactor"), hint: t("profile.twoFactorHint") },
  { icon: "i-lucide-scroll-text", label: t("profile.auditLog"), hint: t("profile.auditLogHint") },
]);

setBreadcrumb([{ label: t("layout.profile") }]);

function openGroupPermissions(group: { id: string; name: string }) {
  selectedGroup.value = group;
  permModalOpen.value = true;
}

// Refresh the session so the summary (avatar, display name) reflects an edit made
// on /profile/edit, and load the domains/recipients this account owns.
useAsyncData(
  "profile-overview",
  async () => {
    try {
      await auth.fetchProfile();
      const overview = await call<{ domains: OwnedDomain[]; recipients: OwnedRecipientSummary[] }>("/auth/jwt/me/overview");
      ownedDomains.value = overview.domains;
      ownedRecipients.value = overview.recipients;
    } catch {
      toast.add({ title: t("profile.toast.loadFailed"), color: "error" });
    }
    return null;
  },
  { server: false }
);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-user-round"
      :title="t('profile.overviewAlertTitle')"
      :description="t('profile.overviewAlertDescription')"
    />

    <UCard>
      <div class="flex items-center gap-4 flex-wrap">
        <PresenceAvatar
          :src="auth.session?.avatarUrl"
          :alt="avatarAlt"
          :online="isOnline(auth.session?.accountId)"
          size="3xl"
          chip-size="xl"
          class="shrink-0"
        />
        <div class="min-w-0">
          <p class="text-lg font-semibold truncate">{{ auth.session?.email }}</p>
          <p class="text-sm text-muted truncate">{{ auth.session?.displayName || "-" }}</p>
        </div>
        <div class="flex flex-wrap gap-1 ml-auto">
          <UBadge v-if="auth.session?.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
            {{ t("layout.rootBadge") }}
          </UBadge>
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <ProfileActionCard
        icon="i-lucide-user-cog"
        :label="t('profile.editProfile')"
        :hint="t('profile.editProfileHint')"
        to="/profile/edit"
      />
      <ProfileActionCard
        icon="i-lucide-settings"
        icon-color="text-info"
        :label="t('layout.preferences')"
        :hint="t('profile.preferencesHint')"
        to="/preferences"
      />
      <ProfileActionCard
        icon="i-lucide-shield-check"
        icon-color="text-success"
        :label="t('profile.permissions.title')"
        :hint="t('profile.permissionsHint')"
        @activate="effectiveModalOpen = true"
      />
      <ProfileActionCard
        icon="i-lucide-monitor"
        icon-color="text-warning"
        :label="t('profile.sessions')"
        :hint="t('profile.sessionsHint')"
        to="/profile/sessions"
      />
      <ProfileActionCard
        icon="i-lucide-bell"
        icon-color="text-primary"
        :label="t('notifications.title')"
        :hint="t('notifications.pageHint')"
        to="/profile/notifications"
      />
      <ProfileActionCard
        v-for="item in comingSoon"
        :key="item.label"
        :icon="item.icon"
        :label="item.label"
        :hint="item.hint"
        soon
      />
    </div>

    <OwnedResourcesCards :domains="ownedDomains" :recipients="ownedRecipients" />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("nav.groups") }}</h2>
      </template>

      <div v-if="auth.session?.groups?.length" class="flex flex-wrap gap-1.5">
        <UBadge
          v-for="group in auth.session.groups"
          :key="group.id"
          as="button"
          type="button"
          color="primary"
          variant="subtle"
          icon="i-lucide-users-round"
          class="max-w-64 cursor-pointer hover:opacity-80"
          :title="t('profile.permissions.title')"
          @click="openGroupPermissions(group)"
        >
          <span class="truncate">{{ group.name }}</span>
        </UBadge>
      </div>

      <p v-else class="text-sm text-muted">{{ t("layout.noGroupBadge") }}</p>
    </UCard>

    <MyGroupPermissionsModal
      v-model:open="permModalOpen"
      :group-id="selectedGroup?.id ?? null"
      :group-name="selectedGroup?.name ?? ''"
    />

    <ProfileEffectivePermissionsModal v-model:open="effectiveModalOpen" />
  </div>
</template>
