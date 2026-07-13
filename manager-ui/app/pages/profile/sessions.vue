<script setup lang="ts">
interface Session {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

definePageMeta({});

const { t, locale } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

const sessions = ref<Session[]>([]);
const loading = ref(false);
const revokingId = ref<number | null>(null);

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.sessionsPage.breadcrumb") }]);

function fmt(iso: string) {
  return new Date(iso).toLocaleString(locale.value.replace(/_/g, "-"));
}

async function load() {
  loading.value = true;
  try {
    sessions.value = await call<Session[]>("/auth/jwt/me/sessions");
  } catch (e) {
    toast.add({ title: t("profile.sessionsPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function revoke(id: number) {
  revokingId.value = id;
  try {
    await call(`/auth/jwt/me/sessions/${id}`, { method: "DELETE" });
    toast.add({ title: t("profile.sessionsPage.toast.revoked"), color: "success" });
    await load();
  } catch (e) {
    toast.add({ title: t("profile.sessionsPage.toast.revokeFailed"), description: (e as Error).message, color: "error" });
  } finally {
    revokingId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-monitor"
      :title="t('profile.sessionsPage.alertTitle')"
      :description="t('profile.sessionsPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("profile.sessions") }}</h2>
      </template>

      <div v-if="loading && sessions.length === 0" class="space-y-3 py-1">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <UEmptyState v-else-if="sessions.length === 0" icon="i-lucide-monitor" :title="t('profile.sessionsPage.empty')" />

      <ul v-else class="divide-y divide-default">
        <li v-for="s in sessions" :key="s.id" class="py-3 flex items-center gap-3">
          <div class="rounded-md p-2 bg-elevated shrink-0">
            <UIcon name="i-lucide-monitor" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ s.userAgent || t("profile.sessionsPage.unknownDevice") }}</p>
            <p class="text-xs text-muted truncate">
              {{ s.ip || t("profile.sessionsPage.unknownIp") }} · {{ t("profile.sessionsPage.signedIn") }} {{ fmt(s.createdAt) }}
            </p>
          </div>
          <UBadge v-if="s.active" color="success" variant="subtle" class="shrink-0">
            {{ t("profile.sessionsPage.active") }}
          </UBadge>
          <UBadge v-else-if="s.revokedAt" color="neutral" variant="subtle" class="shrink-0">
            {{ t("profile.sessionsPage.revoked") }}
          </UBadge>
          <UBadge v-else color="neutral" variant="subtle" class="shrink-0">
            {{ t("profile.sessionsPage.expired") }}
          </UBadge>
          <UButton
            v-if="s.active"
            icon="i-lucide-log-out"
            color="error"
            variant="ghost"
            size="sm"
            :loading="revokingId === s.id"
            :title="t('profile.sessionsPage.revoke')"
            @click="revoke(s.id)"
          />
        </li>
      </ul>
    </UCard>
  </div>
</template>
