<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { GroupDomainPermission, GroupPermission } from "~/composables/useGroups";

const emit = defineEmits<{
  saveGlobal: [{ resource: string; action: string }[]];
  saveDomain: [{ domainId: number; resource: string; action: string }[]];
}>();

const props = defineProps<{
  globalPermissions: GroupPermission[];
  domainPermissions: GroupDomainPermission[];
  domainOptions: { label: string; value: number }[];
  savingGlobal: boolean;
  savingDomain: boolean;
}>();

const activeTab = ref<"global" | "domain">("global");
const selectedDomainId = ref<number | undefined>(undefined);

const globalSet = reactive(new Set<string>());
const domainSets = reactive(new Map<number, Set<string>>());

const { t } = useI18n();
const { call } = useApi();

// Single source of truth for the resource/action catalog is the API, not a
// hardcoded copy here -- see GroupsController.getPermissionsCatalog. A
// resource with no matching key in resourceLabels below just falls back to
// showing its raw name (see the template), which is fine: adding a new
// resource server-side must never require a matching frontend release.
interface DependsOnEntry {
  resource: string;
  action: string[];
}
interface PermissionsCatalog {
  global: { resources: string[]; actions: string[] };
  domain: {
    resources: string[];
    actions: string[];
    dependsOn?: { resource: string; dependsOn: DependsOnEntry[] }[];
  };
}
const { data: catalog, status: catalogStatus } = useAsyncData<PermissionsCatalog | null>(
  "groups-permissions-catalog",
  () => call<PermissionsCatalog>("/groups/permissions/catalog"),
  { server: false, default: () => null }
);
const catalogLoading = computed(() => catalogStatus.value !== "success" && catalogStatus.value !== "error");
const GLOBAL_RESOURCES = computed(() => catalog.value?.global.resources ?? []);
const DOMAIN_RESOURCES = computed(() => catalog.value?.domain.resources ?? []);
const ACTIONS = computed(() => catalog.value?.global.actions ?? []);
// Per domain resource, the (resource, action[]) pairs it requires to have any
// effect at all -- every dependsOn entry AND every action within one entry's
// action[] is mandatory (the guard enforces this at check time regardless of
// what's saved -- see permission-catalog.ts's DOMAIN_RESOURCE_DEPENDS_ON).
// Reshaped from the fetched array into a lookup map for O(1) access below;
// not a hardcoded copy, purely a local view over the fetched data.
const domainDependsOn = computed(() => {
  const map: Record<string, DependsOnEntry[]> = {};
  for (const entry of catalog.value?.domain.dependsOn ?? []) map[entry.resource] = entry.dependsOn;
  return map;
});

const tabItems = computed(() => [
  { label: t("groups.permissions.tabs.global"), value: "global" as const, slot: "global" as const },
  { label: t("groups.permissions.tabs.domain"), value: "domain" as const, slot: "domain" as const },
]);

const resourceLabels = computed<Record<string, string>>(() => ({
  sieve: t("groups.permissions.resources.sieve"),
  rspamd: t("groups.permissions.resources.rspamd"),
  postfix: t("groups.permissions.resources.postfix"),
  accounts: t("groups.permissions.resources.accounts"),
  "api-tokens": t("groups.permissions.resources.apiTokens"),
  groups: t("groups.permissions.resources.groups"),
  domains: t("groups.permissions.resources.domains"),
  domain: t("groups.permissions.resources.domain"),
  recipients: t("groups.permissions.resources.recipients"),
  aliases: t("groups.permissions.resources.aliases"),
  quotas: t("groups.permissions.resources.quotas"),
  dkim: t("groups.permissions.resources.dkim"),
  admin: t("groups.permissions.resources.admin"),
  spamd: t("groups.permissions.resources.spamd"),
}));

const actionLabels = computed<Record<string, string>>(() => ({
  access: t("groups.permissions.actionsLabel.access"),
  read: t("groups.permissions.actionsLabel.read"),
  create: t("groups.permissions.actionsLabel.create"),
  modify: t("groups.permissions.actionsLabel.modify"),
  delete: t("groups.permissions.actionsLabel.delete"),
}));

// Read-only view of the currently selected domain's permission set — used by the
// template so rendering never mutates `domainSets` as a side effect.
const currentDomainSet = computed(() => {
  if (selectedDomainId.value === undefined) return new Set<string>();
  return domainSets.get(selectedDomainId.value) ?? new Set<string>();
});

watch(
  () => [props.globalPermissions, props.domainPermissions],
  () => syncFromProps(),
  { immediate: true }
);

function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function getOrCreateDomainSet(domainId: number) {
  if (!domainSets.has(domainId)) domainSets.set(domainId, new Set());
  return domainSets.get(domainId) as Set<string>;
}

function isDomainAssigned(domainId: number) {
  return domainSets.get(domainId)?.has(permKey("domain", "access")) ?? false;
}

function syncFromProps() {
  globalSet.clear();
  for (const p of props.globalPermissions) globalSet.add(permKey(p.resource, p.action));

  domainSets.clear();
  for (const p of props.domainPermissions) {
    getOrCreateDomainSet(p.domainId).add(permKey(p.resource, p.action));
  }

  if (selectedDomainId.value === undefined || !isDomainAssigned(selectedDomainId.value)) {
    const firstAssigned = [...domainSets.keys()].find((id) => isDomainAssigned(id));
    selectedDomainId.value = firstAssigned;
  }
}

const debouncedSaveGlobal = useDebounceFn(() => {
  const permissions: { resource: string; action: string }[] = [];
  for (const resource of GLOBAL_RESOURCES.value) {
    for (const action of ACTIONS.value) {
      if (globalSet.has(permKey(resource, action))) permissions.push({ resource, action });
    }
  }
  emit("saveGlobal", permissions);
}, 1000);

const debouncedSaveDomain = useDebounceFn(() => {
  const permissions: { domainId: number; resource: string; action: string }[] = [];
  for (const [domainId, set] of domainSets) {
    for (const resource of DOMAIN_RESOURCES.value) {
      for (const action of ACTIONS.value) {
        if (set.has(permKey(resource, action))) permissions.push({ domainId, resource, action });
      }
    }
  }
  emit("saveDomain", permissions);
}, 1000);

// `access` is a prerequisite to the other 4 actions on a given resource: unchecking it
// clears the rest so the UI (and the autosaved payload) never reflects a phantom
// checked-but-disabled state.
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

// Cross-resource counterpart of applyToggle's own-resource "access" rule
// above. Checking any action on a resource that has a dependsOn also grants
// every action of its prerequisite(s) (so it's never checked-but-inert).
// Unchecking clears every resource whose dependsOn required one of the
// actions just cleared on THIS resource -- general on purpose (a resource's
// prerequisite isn't always "domain", e.g. dkim also depends on admin), not
// hardcoded to any one resource name. Single-level: doesn't re-cascade if
// clearing a dependent breaks a further dependent of its own -- the current
// catalog is only 2 levels deep and dkim, the only 2nd-level resource, has
// no dependents itself.
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

function toggleGlobal(resource: string, action: string, checked: boolean) {
  applyToggle(globalSet, resource, action, checked);
  debouncedSaveGlobal();
}

function toggleDomain(resource: string, action: string, checked: boolean) {
  if (selectedDomainId.value === undefined) return;
  const set = getOrCreateDomainSet(selectedDomainId.value);
  applyToggle(set, resource, action, checked);
  // Mirrors applyToggle's own cascade: unchecking "access" clears every
  // action on this resource, not just "access" itself, so a dependent whose
  // requirement targets a different action (e.g. admin:read) must still see
  // it as cleared.
  const clearedActions = !checked && action === "access" ? [...ACTIONS.value] : [action];
  enforceDependsOn(set, resource, clearedActions, checked);
  debouncedSaveDomain();
}

function checkAllGlobalResource(resource: string, checked: boolean) {
  setResourceAll(globalSet, resource, checked);
  debouncedSaveGlobal();
}

function checkAllDomainResource(resource: string, checked: boolean) {
  if (selectedDomainId.value === undefined) return;
  const set = getOrCreateDomainSet(selectedDomainId.value);
  setResourceAll(set, resource, checked);
  enforceDependsOn(set, resource, [...ACTIONS.value], checked);
  debouncedSaveDomain();
}

function checkAllGlobalTab(checked: boolean) {
  for (const resource of GLOBAL_RESOURCES.value) setResourceAll(globalSet, resource, checked);
  debouncedSaveGlobal();
}

function checkAllDomainTab(checked: boolean) {
  if (selectedDomainId.value === undefined) return;
  const set = getOrCreateDomainSet(selectedDomainId.value);
  for (const resource of DOMAIN_RESOURCES.value) setResourceAll(set, resource, checked);
  debouncedSaveDomain();
}

function removeDomainAssignment(domainId: number) {
  domainSets.delete(domainId);
  if (selectedDomainId.value === domainId) {
    const next = [...domainSets.keys()].find((id) => isDomainAssigned(id));
    selectedDomainId.value = next;
  }
  debouncedSaveDomain();
}
</script>

<template>
  <UCard>
    <UTabs v-model="activeTab" :items="tabItems" class="w-full">
      <template #global>
        <div class="space-y-4 pt-4">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <p class="text-xs text-muted">{{ t("groups.permissions.autosaveHint") }}</p>
            <div class="flex items-center gap-2">
              <span v-if="savingGlobal" class="flex items-center gap-1 text-xs text-muted">
                <UIcon name="i-lucide-loader-2" class="animate-spin" />
                {{ t("groups.permissions.saving") }}
              </span>
              <UButton size="xs" color="neutral" variant="outline" @click="checkAllGlobalTab(true)">
                {{ t("groups.permissions.checkAllVisible") }}
              </UButton>
              <UButton size="xs" color="neutral" variant="outline" @click="checkAllGlobalTab(false)">
                {{ t("groups.permissions.uncheckAllVisible") }}
              </UButton>
            </div>
          </div>

          <div v-if="catalogLoading" class="space-y-4">
            <USkeleton v-for="i in 4" :key="i" class="h-24 w-full rounded-lg" />
          </div>
          <GroupPermissionResourceBlock
            v-for="resource in GLOBAL_RESOURCES"
            v-else
            :key="resource"
            :resource="resource"
            :label="resourceLabels[resource] ?? resource"
            :actions="ACTIONS"
            :action-labels="actionLabels"
            :permissions="globalSet"
            @toggle="(action, checked) => toggleGlobal(resource, action, checked)"
            @check-all="(checked) => checkAllGlobalResource(resource, checked)"
          />
        </div>
      </template>

      <template #domain>
        <div class="space-y-4 pt-4">
          <div class="flex flex-wrap items-end gap-2">
            <UFormField :label="t('groups.permissions.selectDomain')">
              <USelectMenu
                v-model="selectedDomainId"
                value-key="value"
                :items="props.domainOptions"
                :placeholder="t('groups.permissions.selectDomainPlaceholder')"
                class="w-56"
              />
            </UFormField>
            <UButton
              v-if="selectedDomainId !== undefined && isDomainAssigned(selectedDomainId)"
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="ghost"
              square
              :title="t('groups.permissions.clearDomainPermissions')"
              @click="removeDomainAssignment(selectedDomainId)"
            />
            <span v-if="savingDomain" class="flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-loader-2" class="animate-spin" />
              {{ t("groups.permissions.saving") }}
            </span>
          </div>

          <div v-if="catalogLoading" class="space-y-4">
            <USkeleton v-for="i in 4" :key="i" class="h-24 w-full rounded-lg" />
          </div>

          <p v-else-if="selectedDomainId === undefined" class="text-sm text-muted">
            {{ t("groups.permissions.noDomainsAssigned") }}
          </p>

          <template v-else>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="text-xs text-muted">{{ t("groups.permissions.autosaveHint") }}</p>
              <div class="flex items-center gap-2">
                <UButton size="xs" color="neutral" variant="outline" @click="checkAllDomainTab(true)">
                  {{ t("groups.permissions.checkAllVisible") }}
                </UButton>
                <UButton size="xs" color="neutral" variant="outline" @click="checkAllDomainTab(false)">
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
              @toggle="(action, checked) => toggleDomain(resource, action, checked)"
              @check-all="(checked) => checkAllDomainResource(resource, checked)"
            />
          </template>
        </div>
      </template>
    </UTabs>
  </UCard>
</template>
