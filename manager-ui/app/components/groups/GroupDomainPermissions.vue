<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { DependsOnEntry, GroupDomainPermission, PermissionsCatalog } from "~/composables/useGroups";

const emit = defineEmits<{ save: [{ domainId: number; resource: string; action: string }[]] }>();

const props = defineProps<{
  groupId: number;
  domainPermissions: GroupDomainPermission[];
  domainOptions: { label: string; value: number }[];
  // Resolved from the route (/groups/:id/domain/:domain) by the parent page --
  // undefined when no domain segment is present yet (bare /groups/:id/domain).
  selectedDomainId: number | undefined;
  saving: boolean;
}>();

// Holds every domain the group has ANY permission on, not just the one
// currently displayed: setDomainPermissions is a full replace (see
// groups.openapi.ts), so switching to view domain B must not lose domain
// A's already-set permissions out of the next save payload.
const domainSets = reactive(new Map<number, Set<string>>());

const { t } = useI18n();
const { call } = useApi();
const { domainResourceLabels: resourceLabels, actionLabels } = usePermissionLabels();

const { data: catalog, status: catalogStatus } = useAsyncData<PermissionsCatalog | null>(
  "groups-permissions-catalog",
  () => call<PermissionsCatalog>("/groups/permissions/catalog"),
  { server: false, default: () => null }
);
const catalogLoading = computed(() => catalogStatus.value !== "success" && catalogStatus.value !== "error");
const DOMAIN_RESOURCES = computed(() => catalog.value?.domain.resources ?? []);
const ACTIONS = computed(() => catalog.value?.domain.actions ?? []);
const domainDependsOn = computed(() => {
  const map: Record<string, DependsOnEntry[]> = {};
  for (const entry of catalog.value?.domain.dependsOn ?? []) map[entry.resource] = entry.dependsOn;
  return map;
});

// Read-only view of the currently displayed domain's permission set -- used
// by the template so rendering never mutates `domainSets` as a side effect.
const currentDomainSet = computed(() => {
  if (props.selectedDomainId === undefined) return new Set<string>();
  return domainSets.get(props.selectedDomainId) ?? new Set<string>();
});

// The select menu's own v-model: reading reflects the route-resolved prop,
// writing navigates to the picked domain's URL instead of mutating local
// state -- the route is the source of truth for which domain is shown.
const pickedDomainId = computed<number | undefined>({
  get: () => props.selectedDomainId,
  set: (value) => {
    if (value === undefined) return;
    const fqdn = props.domainOptions.find((o) => o.value === value)?.label;
    if (fqdn) navigateTo(`/groups/${props.groupId}/acl/domain/${fqdn}`);
  },
});

watch(() => props.domainPermissions, syncFromProps, { immediate: true });

function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function getOrCreateDomainSet(domainId: number) {
  if (!domainSets.has(domainId)) domainSets.set(domainId, new Set());
  return domainSets.get(domainId) as Set<string>;
}

function syncFromProps() {
  domainSets.clear();
  for (const p of props.domainPermissions) {
    getOrCreateDomainSet(p.domainId).add(permKey(p.resource, p.action));
  }
}

const debouncedSave = useDebounceFn(() => {
  const permissions: { domainId: number; resource: string; action: string }[] = [];
  for (const [domainId, set] of domainSets) {
    for (const resource of DOMAIN_RESOURCES.value) {
      for (const action of ACTIONS.value) {
        if (set.has(permKey(resource, action))) permissions.push({ domainId, resource, action });
      }
    }
  }
  emit("save", permissions);
}, 1000);

function applyToggle(set: Set<string>, resource: string, action: string, checked: boolean) {
  if (action === "access" && !checked) {
    for (const a of ACTIONS.value) set.delete(permKey(resource, a));
    return;
  }
  const key = permKey(resource, action);
  if (checked) set.add(key);
  else set.delete(key);
}

function setResourceAll(set: Set<string>, resource: string, checked: boolean) {
  for (const a of ACTIONS.value) {
    const key = permKey(resource, a);
    if (checked) set.add(key);
    else set.delete(key);
  }
}

function enforceDependsOn(set: Set<string>, resource: string, clearedActions: string[], checked: boolean) {
  if (checked) {
    for (const dep of domainDependsOn.value[resource] ?? []) {
      for (const action of dep.action) set.add(permKey(dep.resource, action));
    }
    return;
  }
  for (const [dependent, deps] of Object.entries(domainDependsOn.value)) {
    const broken = deps.some((d) => d.resource === resource && d.action.some((a) => clearedActions.includes(a)));
    if (broken) setResourceAll(set, dependent, false);
  }
}

function toggle(resource: string, action: string, checked: boolean) {
  if (props.selectedDomainId === undefined) return;
  const set = getOrCreateDomainSet(props.selectedDomainId);
  applyToggle(set, resource, action, checked);
  const clearedActions = !checked && action === "access" ? [...ACTIONS.value] : [action];
  enforceDependsOn(set, resource, clearedActions, checked);
  debouncedSave();
}

function checkAllResource(resource: string, checked: boolean) {
  if (props.selectedDomainId === undefined) return;
  const set = getOrCreateDomainSet(props.selectedDomainId);
  setResourceAll(set, resource, checked);
  enforceDependsOn(set, resource, [...ACTIONS.value], checked);
  debouncedSave();
}

function checkAllVisible(checked: boolean) {
  if (props.selectedDomainId === undefined) return;
  const set = getOrCreateDomainSet(props.selectedDomainId);
  for (const resource of DOMAIN_RESOURCES.value) setResourceAll(set, resource, checked);
  debouncedSave();
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <div class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('groups.permissions.selectDomain')">
          <USelectMenu
            v-model="pickedDomainId"
            value-key="value"
            :items="domainOptions"
            :placeholder="t('groups.permissions.selectDomainPlaceholder')"
            class="w-56"
          />
        </UFormField>
        <span v-if="saving" class="flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-loader-2" class="animate-spin" />
          {{ t("groups.permissions.saving") }}
        </span>
      </div>
    </UCard>

    <div v-if="catalogLoading" class="space-y-4">
      <USkeleton v-for="i in 4" :key="i" class="h-24 w-full rounded-lg" />
    </div>

    <UCard v-else-if="selectedDomainId === undefined">
      <p class="text-sm text-muted">{{ t("groups.permissions.noDomainsAssigned") }}</p>
    </UCard>

    <template v-else>
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <p class="text-xs text-muted">{{ t("groups.permissions.autosaveHint") }}</p>
        <div class="flex items-center gap-2">
          <UButton size="xs" color="neutral" variant="outline" @click="checkAllVisible(true)">
            {{ t("groups.permissions.checkAllVisible") }}
          </UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="checkAllVisible(false)">
            {{ t("groups.permissions.uncheckAllVisible") }}
          </UButton>
        </div>
      </div>

      <GroupPermissionResourceBlock
        v-for="resource in DOMAIN_RESOURCES"
        :key="resource"
        :resource="resource"
        :label="resourceLabels[resource] ?? resource"
        :actions="ACTIONS"
        :action-labels="actionLabels"
        :permissions="currentDomainSet"
        @toggle="(action, checked) => toggle(resource, action, checked)"
        @check-all="(checked) => checkAllResource(resource, checked)"
      />
    </template>
  </div>
</template>
