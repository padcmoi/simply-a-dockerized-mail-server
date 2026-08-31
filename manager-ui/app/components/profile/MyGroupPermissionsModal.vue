<script setup lang="ts">
// Shows the permissions of a group the CALLER belongs to, fetched from the
// self-scoped, membership-gated /auth/jwt/me/groups/:id/permissions endpoint.
// This is the one place a member may inspect what their own group grants, even
// when that group is invisible (hidden from the Groups section everywhere else).
const emit = defineEmits<{ "update:open": [boolean] }>();
const props = defineProps<{
  open: boolean;
  groupId: string | null;
  groupName: string;
}>();

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
// Shared slug -> localized label mapping (resources + actions), same source the
// group permission grid uses, so a group reads identically here.
const { globalResourceLabels, domainResourceLabels, actionLabel } = usePermissionLabels();

const loading = ref(false);
const globalPermissions = ref<{ resource: string; action: string }[]>([]);
// domainName is resolved server-side (works for domains the caller does not own).
const domainPermissions = ref<{ domainId: number; domainName: string; resource: string; action: string }[]>([]);

// Same one-badge-per-resource shaping as the profile's own effective-permissions
// card, so a group reads identically whether seen there or here. sortActions is
// a hoisted function declaration, usable by the computeds above its definition.
const groupedGlobal = computed(() => {
  const byResource = new Map<string, string[]>();
  for (const p of globalPermissions.value) {
    byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p.action]);
  }
  return [...byResource.entries()].map(([resource, actions]) => ({
    resource,
    label: globalResourceLabels.value[resource] ?? resource,
    actions: sortActions(actions).map((a) => actionLabel("global", resource, a)),
  }));
});

const groupedDomain = computed(() => {
  const byKey = new Map<string, { domainId: number; domainName: string; resource: string; actions: string[] }>();
  for (const p of domainPermissions.value) {
    const key = `${p.domainId}:${p.resource}`;
    const entry = byKey.get(key) ?? { domainId: p.domainId, domainName: p.domainName, resource: p.resource, actions: [] };
    entry.actions.push(p.action);
    byKey.set(key, entry);
  }
  return [...byKey.values()].map((entry) => ({
    domainId: entry.domainId,
    domainName: entry.domainName,
    resource: entry.resource,
    label: domainResourceLabels.value[entry.resource] ?? entry.resource,
    actions: sortActions(entry.actions).map((a) => actionLabel("domain", entry.resource, a)),
  }));
});

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen || !props.groupId) return;
    loading.value = true;
    globalPermissions.value = [];
    domainPermissions.value = [];
    try {
      const res = await call<{
        globalPermissions: { resource: string; action: string }[];
        domainPermissions: { domainId: number; domainName: string; resource: string; action: string }[];
      }>(`/auth/jwt/me/groups/${props.groupId}/permissions`);
      globalPermissions.value = res.globalPermissions;
      domainPermissions.value = res.domainPermissions;
    } catch (e) {
      toast.add({ title: t("profile.permissions.loadFailed"), description: (e as Error).message, color: "error" });
    } finally {
      loading.value = false;
    }
  }
);

const ACTION_ORDER = ["access", "read", "create", "modify", "delete"];
function sortActions(actions: string[]) {
  return [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 min-w-0">
            <UIcon name="i-lucide-users-round" class="text-primary shrink-0" />
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{{ groupName }}</h3>
              <p class="text-xs text-muted">{{ t("profile.permissions.title") }}</p>
            </div>
          </div>
        </template>

        <div v-if="loading" class="flex justify-center py-6">
          <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
        </div>

        <div v-else class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.globalTitle") }}</h4>
            <p v-if="groupedGlobal.length === 0" class="text-sm text-muted">{{ t("profile.permissions.empty") }}</p>
            <ul v-else class="space-y-2.5">
              <li v-for="g in groupedGlobal" :key="g.resource">
                <p class="text-sm font-medium">{{ g.label }}</p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <UBadge v-for="a in g.actions" :key="a" color="success" variant="subtle" size="md">{{ a }}</UBadge>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.domainTitle") }}</h4>
            <p v-if="groupedDomain.length === 0" class="text-sm text-muted">{{ t("profile.permissions.empty") }}</p>
            <ul v-else class="space-y-2.5">
              <li v-for="g in groupedDomain" :key="`${g.domainId}:${g.resource}`">
                <p class="text-sm font-medium">{{ g.domainName }} · {{ g.label }}</p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <UBadge v-for="a in g.actions" :key="a" color="success" variant="subtle" size="md">{{ a }}</UBadge>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t("common.cancel") }}</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
