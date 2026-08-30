<script setup lang="ts">
// Gated by the "admin" domain ACL (not the generic "domain" resource the main
// dashboard requires) -- DKIM key material and ownership transfer are
// sensitive, kept off the day-to-day dashboard on purpose.
definePageMeta({
  requiredDomain: [
    { resource: "admin", action: "access" },
    { resource: "admin", action: "view-admin-page" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const route = useRoute();

const domainFqdn = computed(() => String(route.params.domain));

const {
  domain,
  ownerPick,
  savingOwner,
  savingActive,
  accountOptions,
  ownerOptionsLoading,
  dkimKeys,
  dkimLoading,
  dkimCheck,
  isOwnerOrRoot,
  rotateDkim,
  deleteDkim,
  toggleActive,
  copyToClipboard,
  changeDomainOwner,
} = useDomainSettings(() => domainFqdn.value);

// Each item's `slot` names the matching #<slot> template below -- same
// pattern as GroupDetailTabs/GroupPermissionsPanel's own UTabs items.
const accordionItems = computed(() => [
  { label: t("domainDashboard.status.title"), icon: "i-lucide-power", slot: "status" as const },
  { label: t("domainDashboard.dkim.title"), icon: "i-lucide-key", slot: "dkim" as const },
  { label: t("domainDashboard.owner.title"), icon: "i-lucide-crown", slot: "owner" as const },
]);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.admin") },
  ]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="warning" variant="subtle" icon="i-lucide-shield-alert" :title="t('domainDashboard.admin.subtitle')" />

    <UAccordion :items="accordionItems" :ui="{ trigger: 'py-4', body: 'pb-6' }">
      <template #status>
        <ContentPanel class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">{{ domain?.active === 1 ? t("common.active") : t("common.inactive") }}</p>
            <p class="text-xs text-muted">{{ t("domainDashboard.status.hint") }}</p>
          </div>
          <USwitch
            :model-value="domain?.active === 1"
            :loading="savingActive"
            :disabled="savingActive"
            @update:model-value="toggleActive"
          />
        </ContentPanel>
      </template>

      <template #dkim>
        <DomainDkimSection
          :keys="dkimKeys"
          :loading="dkimLoading"
          :check-result="dkimCheck"
          @rotate="rotateDkim"
          @delete="deleteDkim"
          @copy="copyToClipboard"
        />
      </template>

      <template #owner>
        <ContentPanel>
          <p class="text-sm mb-3">
            {{ t("domainDashboard.owner.current") }}:
            <span class="font-medium">{{ domain?.ownerEmail ?? t("domainDashboard.owner.unassigned") }}</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <USkeleton v-if="ownerOptionsLoading" class="h-8 w-48 rounded-md" />
            <USelectMenu
              v-else
              v-model="ownerPick"
              value-key="value"
              :items="accountOptions"
              :placeholder="t('domainDashboard.owner.pickPlaceholder')"
              class="min-w-[12rem]"
            />
            <UButton
              color="neutral"
              variant="outline"
              :loading="savingOwner"
              :disabled="ownerPick === undefined || !isOwnerOrRoot"
              @click="changeDomainOwner"
            >
              {{ t("domainDashboard.owner.change") }}
            </UButton>
          </div>
        </ContentPanel>
      </template>
    </UAccordion>
  </div>
</template>
