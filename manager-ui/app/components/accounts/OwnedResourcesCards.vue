<script setup lang="ts">
// Two list cards: the domains and recipients an account owns. Shared by the admin
// account dashboard (/accounts/:id) and the self-service profile (/profile), both
// fed the same shape (from GET /accounts/:id/overview and GET /auth/jwt/me/overview).
interface OwnedDomain {
  id: number;
  domain: string;
  active: boolean;
  quota: string;
}
interface OwnedRecipient {
  id: number;
  email: string;
  domain: string;
  active: boolean;
  quota: string;
}

defineProps<{
  domains: OwnedDomain[];
  recipients: OwnedRecipient[];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.overviewPage.ownedDomains") }}</h2>
      </template>
      <UEmptyState v-if="domains.length === 0" icon="i-lucide-globe" :title="t('accounts.overviewPage.noDomains')" />
      <ul v-else class="divide-y divide-default">
        <li
          v-for="d in domains"
          :key="d.id"
          class="py-3 flex items-center gap-3 cursor-pointer hover:bg-elevated/50 transition-colors rounded-md px-1 -mx-1"
          @click="navigateTo(`/admin/domains/${d.domain}`)"
        >
          <div class="rounded-md p-2 bg-elevated shrink-0">
            <UIcon name="i-lucide-globe" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ d.domain }}</p>
            <p class="text-xs text-muted">{{ t("accounts.overviewPage.quotaLabel", { value: d.quota }) }}</p>
          </div>
          <UBadge :color="d.active ? 'success' : 'neutral'" variant="subtle">
            {{ d.active ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.overviewPage.ownedRecipients") }}</h2>
      </template>
      <UEmptyState v-if="recipients.length === 0" icon="i-lucide-users" :title="t('accounts.overviewPage.noRecipients')" />
      <ul v-else class="divide-y divide-default">
        <li
          v-for="r in recipients"
          :key="r.id"
          class="py-3 flex items-center gap-3 cursor-pointer hover:bg-elevated/50 transition-colors rounded-md px-1 -mx-1"
          @click="navigateTo(`/admin/domains/${r.domain}/recipients`)"
        >
          <UAvatar :alt="r.email" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ r.email }}</p>
            <p class="text-xs text-muted">{{ r.domain }}</p>
          </div>
          <UBadge :color="r.active ? 'success' : 'neutral'" variant="subtle">
            {{ r.active ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </li>
      </ul>
    </UCard>
  </div>
</template>
