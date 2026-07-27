<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "view-group" },
    { resource: "groups", action: "edit-group-domain-permissions" },
  ],
});

const savingDomainPerms = ref(false);
const domainOptions = ref<{ label: string; value: number }[]>([]);
const domainsLoading = ref(true);

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { setDomainPermissions } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading, refresh } = useGroupDetail(groupId);

// Optional segment (pages/groups/[id]/acl/domain/[[domain]].vue): undefined
// on the bare /groups/:id/acl/domain landing, the FQDN once one is picked.
const domainFqdn = computed(() => {
  const raw = route.params.domain;
  return Array.isArray(raw) ? raw[0] : raw;
});
const selectedDomainId = computed(() => domainOptions.value.find((o) => o.label === domainFqdn.value)?.value);

// The bare /groups/:id/acl/domain landing (no FQDN segment) is a real,
// stable state -- it must stay reachable (e.g. via this very "Domaine"
// crumb, or browser back) rather than being auto-redirected away from, so
// the "Domaine" crumb only links back to it once a specific domain shows.
watchEffect(() => {
  const crumbs = [
    { label: t("nav.groups"), to: "/admin/groups" },
    { label: group.value?.name ?? "...", to: `/admin/groups/${groupId.value}` },
    {
      label: t("groups.detail.tabs.domain"),
      to: domainFqdn.value ? `/admin/groups/${groupId.value}/acl/domain` : undefined,
    },
  ];
  if (domainFqdn.value) crumbs.push({ label: domainFqdn.value, to: undefined });
  setBreadcrumb(crumbs);
});

async function loadDomains() {
  domainsLoading.value = true;
  try {
    const domains = await call<{ id: number; domain: string }[]>("/domains");
    domainOptions.value = domains.map((d) => ({ label: d.domain, value: d.id }));
  } finally {
    domainsLoading.value = false;
  }
}

async function onSaveDomain(permissions: { domainId: number; resource: string; action: string }[]) {
  savingDomainPerms.value = true;
  try {
    const updated = await setDomainPermissions(groupId.value, permissions);
    if (group.value) group.value.domainPermissions = updated.domainPermissions;
    toast.add({ title: t("groups.detail.permissions.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.permissions.saveFailed"), description: (e as Error).message, color: "error" });
    await refresh();
  } finally {
    savingDomainPerms.value = false;
  }
}

onMounted(loadDomains);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-globe"
      :title="t('groups.detail.alerts.domain.title')"
      :description="t('groups.detail.alerts.domain.description')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/groups" size="sm">
      {{ t("groups.backToList") }}
    </UButton>

    <div v-if="(loading && !group) || domainsLoading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <template v-else-if="group">
      <GroupDetailTabs
        :group-id="groupId"
        active="domain"
        :group-name="group.name"
        :is-protected="group.protected"
        :domain-label="domainFqdn"
      />

      <GroupDomainPermissions
        :group-id="groupId"
        :domain-permissions="group.domainPermissions"
        :domain-options="domainOptions"
        :selected-domain-id="selectedDomainId"
        :saving="savingDomainPerms"
        @save="onSaveDomain"
      />
    </template>
  </div>
</template>
