<script setup lang="ts">
import { usePermissionsStore } from "~/stores/permissions";
import { useAuthStore } from "~/stores/auth";

// The account's TOTAL effective permissions (the union across all its groups),
// grouped by resource with localized labels. Self-scoped: reads the caller's own
// permissions store; root short-circuits to a single "full access" badge.
const open = defineModel<boolean>("open", { required: true });

const { t } = useI18n();
const auth = useAuthStore();
const perms = usePermissionsStore();
const toast = useToast();
const { globalResourceLabels, domainResourceLabels, actionLabel } = usePermissionLabels();

// One badge per resource (e.g. "recipients: access, read") reads far better than
// one badge per raw {resource,action} pair now that every resource carries up to
// 5 actions instead of 2.
const ACTION_ORDER = ["access", "read", "create", "modify", "delete"];

function sortActions(actions: string[]) {
  return [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
}

const groupedGlobalPermissions = computed(() => {
  const byResource = new Map<string, string[]>();
  for (const p of perms.data.global) {
    byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p.action]);
  }
  return [...byResource.entries()].map(([resource, actions]) => ({
    resource,
    label: globalResourceLabels.value[resource] ?? resource,
    actions: sortActions(actions).map((a) => actionLabel("global", resource, a)),
  }));
});

const groupedDomainPermissions = computed(() => {
  const byKey = new Map<string, { domainId: number; domainName: string; resource: string; actions: string[] }>();
  for (const p of perms.data.domain) {
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

const { status } = useAsyncData(
  "profile-permissions",
  async () => {
    try {
      await perms.fetch();
    } catch {
      toast.add({ title: t("profile.permissions.loadFailed"), color: "error" });
    }
    return null;
  },
  { server: false }
);
const loading = computed(() => status.value !== "success" && status.value !== "error");

function close() {
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 min-w-0">
            <UIcon name="i-lucide-shield-check" class="text-primary shrink-0" />
            <h3 class="font-semibold truncate">{{ t("profile.permissions.title") }}</h3>
          </div>
        </template>

        <div v-if="loading" class="flex justify-center py-6">
          <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
        </div>

        <UBadge v-else-if="auth.session?.isRoot" color="primary" variant="subtle" icon="i-lucide-shield-check">
          {{ t("profile.permissions.root") }}
        </UBadge>

        <div v-else class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.globalTitle") }}</h4>
            <p v-if="groupedGlobalPermissions.length === 0" class="text-sm text-muted">
              {{ t("profile.permissions.empty") }}
            </p>
            <ul v-else class="space-y-2.5">
              <li v-for="g in groupedGlobalPermissions" :key="g.resource">
                <p class="text-sm font-medium">{{ g.label }}</p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <UBadge v-for="a in g.actions" :key="a" color="success" variant="subtle" size="md">{{ a }}</UBadge>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.domainTitle") }}</h4>
            <p v-if="groupedDomainPermissions.length === 0" class="text-sm text-muted">
              {{ t("profile.permissions.empty") }}
            </p>
            <ul v-else class="space-y-2.5">
              <li v-for="g in groupedDomainPermissions" :key="`${g.domainId}:${g.resource}`">
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
            <UButton color="neutral" variant="ghost" @click="close">{{ t("common.cancel") }}</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
