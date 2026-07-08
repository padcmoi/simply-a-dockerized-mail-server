<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { DependsOnEntry, GroupPermission, PermissionsCatalog } from "~/composables/useGroups";

const emit = defineEmits<{ save: [{ resource: string; action: string }[]] }>();

const props = defineProps<{
  globalPermissions: GroupPermission[];
  saving: boolean;
}>();

const globalSet = reactive(new Set<string>());

const { t } = useI18n();
const { call } = useApi();
const { resourceLabels, actionLabels } = usePermissionLabels();

// Single source of truth for the resource/action catalog is the API, not a
// hardcoded copy here -- see GroupsController.getPermissionsCatalog.
const { data: catalog, status: catalogStatus } = useAsyncData<PermissionsCatalog | null>(
  "groups-permissions-catalog",
  () => call<PermissionsCatalog>("/groups/permissions/catalog"),
  { server: false, default: () => null }
);
const catalogLoading = computed(() => catalogStatus.value !== "success" && catalogStatus.value !== "error");
const GLOBAL_RESOURCES = computed(() => catalog.value?.global.resources ?? []);
const ACTIONS = computed(() => catalog.value?.global.actions ?? []);
// Per resource, the (resource, action[]) pairs it requires to have any
// effect at all -- see permission-catalog.ts's GLOBAL_RESOURCES_DEPENDS_ON.
const globalDependsOn = computed(() => {
  const map: Record<string, DependsOnEntry[]> = {};
  for (const entry of catalog.value?.global.dependsOn ?? []) map[entry.resource] = entry.dependsOn;
  return map;
});

watch(() => props.globalPermissions, syncFromProps, { immediate: true });

function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function syncFromProps() {
  globalSet.clear();
  for (const p of props.globalPermissions) globalSet.add(permKey(p.resource, p.action));
}

const debouncedSave = useDebounceFn(() => {
  const permissions: { resource: string; action: string }[] = [];
  for (const resource of GLOBAL_RESOURCES.value) {
    for (const action of ACTIONS.value) {
      if (globalSet.has(permKey(resource, action))) permissions.push({ resource, action });
    }
  }
  emit("save", permissions);
}, 1000);

// `access` is a prerequisite to the other 4 actions on a given resource: unchecking it
// clears the rest so the UI (and the autosaved payload) never reflects a phantom
// checked-but-disabled state.
function applyToggle(resource: string, action: string, checked: boolean) {
  if (action === "access" && !checked) {
    for (const a of ACTIONS.value) globalSet.delete(permKey(resource, a));
    return;
  }
  const key = permKey(resource, action);
  if (checked) globalSet.add(key);
  else globalSet.delete(key);
}

function setResourceAll(resource: string, checked: boolean) {
  for (const a of ACTIONS.value) {
    const key = permKey(resource, a);
    if (checked) globalSet.add(key);
    else globalSet.delete(key);
  }
}

// Cross-resource counterpart of applyToggle's own-resource "access" rule
// above. Checking a resource's action also grants every action of its
// prerequisite(s); unchecking clears every resource whose dependsOn required
// one of the actions just cleared -- general on purpose, not hardcoded to
// any one resource name.
function enforceDependsOn(resource: string, clearedActions: string[], checked: boolean) {
  if (checked) {
    for (const dep of globalDependsOn.value[resource] ?? []) {
      for (const action of dep.action) globalSet.add(permKey(dep.resource, action));
    }
    return;
  }
  for (const [dependent, deps] of Object.entries(globalDependsOn.value)) {
    const broken = deps.some((d) => d.resource === resource && d.action.some((a) => clearedActions.includes(a)));
    if (broken) setResourceAll(dependent, false);
  }
}

function toggle(resource: string, action: string, checked: boolean) {
  applyToggle(resource, action, checked);
  const clearedActions = !checked && action === "access" ? [...ACTIONS.value] : [action];
  enforceDependsOn(resource, clearedActions, checked);
  debouncedSave();
}

function checkAllResource(resource: string, checked: boolean) {
  setResourceAll(resource, checked);
  enforceDependsOn(resource, [...ACTIONS.value], checked);
  debouncedSave();
}

function checkAllVisible(checked: boolean) {
  for (const resource of GLOBAL_RESOURCES.value) setResourceAll(resource, checked);
  debouncedSave();
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <p class="text-xs text-muted">{{ t("groups.permissions.autosaveHint") }}</p>
        <div class="flex items-center gap-2">
          <span v-if="saving" class="flex items-center gap-1 text-xs text-muted">
            <UIcon name="i-lucide-loader-2" class="animate-spin" />
            {{ t("groups.permissions.saving") }}
          </span>
          <UButton size="xs" color="neutral" variant="outline" @click="checkAllVisible(true)">
            {{ t("groups.permissions.checkAllVisible") }}
          </UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="checkAllVisible(false)">
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
        @toggle="(action, checked) => toggle(resource, action, checked)"
        @check-all="(checked) => checkAllResource(resource, checked)"
      />
    </div>
  </UCard>
</template>
