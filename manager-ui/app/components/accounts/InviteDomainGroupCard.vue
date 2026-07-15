<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { DependsOnEntry, GroupDetail, PermissionsCatalog } from "~/composables/useGroups";

const emit = defineEmits<{ created: [] }>();

const props = defineProps<{
  domainId: number | undefined;
  domainLabel: string | undefined;
}>();

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { isRoot, hasGlobal } = usePermissions();
const { domainResourceLabels: resourceLabels, actionLabelsFor } = usePermissionLabels();
const { groups, create, setDomainPermissions, getDetail } = useGroups();

// Shared cache key with GroupDomainPermissions: the catalog is identical and the
// endpoint is gated by groups:view-group, so a user without groups access simply
// gets null (the card then locks itself).
const { data: catalog } = useAsyncData<PermissionsCatalog | null>(
  "groups-permissions-catalog",
  () => call<PermissionsCatalog>("/groups/permissions/catalog"),
  { server: false, default: () => null }
);

const enabled = ref(false);
const detail = ref<GroupDetail | null>(null);
const saving = ref(false);
// Name of the group whose editor state we own (created from this card). Set
// synchronously BEFORE create() so the create-driven reload watcher recognises
// it and never clobbers the live checkboxes with an empty refetch.
const selfManagedName = ref<string | null>(null);
const currentSet = reactive(new Set<string>());
// Memoises the in-flight creation so many rapid clicks create the group once.
let ensurePromise: Promise<string> | null = null;

// The name is imposed, never chosen: one dedicated group per domain.
const imposedName = computed(() => (props.domainLabel ? `custom-${props.domainLabel}-group` : ""));
const existingGroup = computed(() => groups.value.find((g) => g.name === imposedName.value) ?? null);
// The card requires the WHOLE groups resource (or root), per the feature spec.
// The action list comes from the catalog (single source of truth); a user who
// cannot even read the catalog is, by definition, missing groups actions.
const groupsActions = computed(() => catalog.value?.global.actionsByResource.groups ?? []);
const canManage = computed(
  () => isRoot.value || (groupsActions.value.length > 0 && groupsActions.value.every((a) => hasGlobal("groups", a)))
);
const domainResources = computed(() => catalog.value?.domain.resources ?? []);
const actionsByResource = computed(() => catalog.value?.domain.actionsByResource ?? {});
const domainDependsOn = computed(() => {
  const map: Record<string, DependsOnEntry[]> = {};
  for (const entry of catalog.value?.domain.dependsOn ?? []) map[entry.resource] = entry.dependsOn;
  return map;
});

watch([enabled, () => existingGroup.value?.id, () => props.domainId], async ([en, gid, dom], [, , prevDom]) => {
  // A new target domain (or the switch turning off) means we no longer own any
  // prior group's editor state.
  if (dom !== prevDom || !en) {
    selfManagedName.value = null;
    ensurePromise = null;
  }
  if (!en) {
    detail.value = null;
    syncCurrentSet();
    return;
  }
  // We created this group from the card: keep the live checkboxes, never refetch
  // over them (the refetch would race setDomainPermissions and reset them).
  if (selfManagedName.value && existingGroup.value?.name === selfManagedName.value) return;
  detail.value = gid ? await getDetail(gid) : null;
  syncCurrentSet();
});

const debouncedPersist = useDebounceFn(persist, 1000);

function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function actionsOf(resource: string) {
  return actionsByResource.value[resource] ?? [];
}

// (Re)load the editor's checkboxes for the currently targeted domain from the
// selected group's existing permissions (empty for a brand-new group).
function syncCurrentSet() {
  currentSet.clear();
  if (!detail.value || props.domainId === undefined) return;
  for (const p of detail.value.domainPermissions) {
    if (p.domainId === props.domainId) currentSet.add(permKey(p.resource, p.action));
  }
}

// Creates the imposed group the moment it is needed (first check), once. The
// name guard is set BEFORE create so the resulting groups mutation does not make
// the watcher wipe the in-progress selection.
function ensureGroupId() {
  const existing = existingGroup.value;
  if (existing) return Promise.resolve(existing.id);
  if (!ensurePromise) {
    selfManagedName.value = imposedName.value;
    ensurePromise = create({ name: imposedName.value })
      .then((g) => {
        emit("created");
        return g.id;
      })
      .catch((e) => {
        // Let a later edit retry instead of being stuck on a rejected promise.
        ensurePromise = null;
        selfManagedName.value = null;
        throw e;
      });
  }
  return ensurePromise;
}

function applyToggle(resource: string, action: string, checked: boolean) {
  if (action === "access" && !checked) {
    for (const a of actionsOf(resource)) currentSet.delete(permKey(resource, a));
    return;
  }
  if (checked) currentSet.add(permKey(resource, action));
  else currentSet.delete(permKey(resource, action));
}

function setResourceAll(resource: string, checked: boolean) {
  for (const a of actionsOf(resource)) {
    if (checked) currentSet.add(permKey(resource, a));
    else currentSet.delete(permKey(resource, a));
  }
}

function enforceDependsOn(resource: string, clearedActions: string[], checked: boolean) {
  if (checked) {
    for (const dep of domainDependsOn.value[resource] ?? []) {
      for (const action of dep.action) currentSet.add(permKey(dep.resource, action));
    }
    return;
  }
  for (const [dependent, deps] of Object.entries(domainDependsOn.value)) {
    const broken = deps.some((d) => d.resource === resource && d.action.some((a) => clearedActions.includes(a)));
    if (broken) setResourceAll(dependent, false);
  }
}

// Any edit both creates the group right away (if missing) and schedules the
// debounced save of the permissions.
function afterEdit() {
  if (enabled.value && props.domainId !== undefined && currentSet.size > 0) void ensureGroupId();
  debouncedPersist();
}

function toggle(resource: string, action: string, checked: boolean) {
  applyToggle(resource, action, checked);
  const clearedActions = !checked && action === "access" ? [...actionsOf(resource)] : [action];
  enforceDependsOn(resource, clearedActions, checked);
  afterEdit();
}

function checkAllResource(resource: string, checked: boolean) {
  setResourceAll(resource, checked);
  enforceDependsOn(resource, [...actionsOf(resource)], checked);
  afterEdit();
}

// Autosaves the targeted domain's permissions. Permissions on OTHER domains are
// preserved (setDomainPermissions is a full replace).
async function persist() {
  if (!canManage.value || !enabled.value || props.domainId === undefined) return;
  if (!existingGroup.value && !ensurePromise && currentSet.size === 0) return;
  saving.value = true;
  try {
    const groupId = await ensureGroupId();
    const otherDomains = (detail.value?.domainPermissions ?? [])
      .filter((p) => p.domainId !== props.domainId)
      .map((p) => ({ domainId: p.domainId, resource: p.resource, action: p.action }));
    const targeted = [...currentSet].map((key) => {
      const idx = key.indexOf(":");
      return { domainId: props.domainId as number, resource: key.slice(0, idx), action: key.slice(idx + 1) };
    });
    detail.value = await setDomainPermissions(groupId, [...otherDomains, ...targeted]);
    toast.add({ title: t("accounts.invite.groupPerms.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("accounts.invite.groupPerms.failed"), description: (e as Error).message, color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UCard v-if="domainId !== undefined">
    <template #header>
      <h2 class="font-semibold flex items-center gap-1.5">
        <UIcon name="i-lucide-shield-check" class="size-4 text-muted" />
        {{ t("accounts.invite.groupPerms.title") }}
      </h2>
    </template>

    <div v-if="!canManage" class="text-sm text-warning flex items-center gap-1.5">
      <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
      {{ t("accounts.invite.groupPerms.noRight") }}
    </div>

    <div v-else class="space-y-4">
      <p class="text-xs text-muted">{{ t("accounts.invite.groupPerms.hint") }}</p>

      <USwitch v-model="enabled" :label="t('accounts.invite.groupPerms.switchLabel')" />

      <template v-if="enabled">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-muted">{{ t("accounts.invite.groupPerms.groupLabel") }}</span>
          <UBadge color="neutral" variant="subtle">{{ imposedName }}</UBadge>
          <UBadge :color="existingGroup ? 'primary' : 'success'" variant="soft">
            {{ existingGroup ? t("accounts.invite.groupPerms.exists") : t("accounts.invite.groupPerms.willCreate") }}
          </UBadge>
          <span v-if="saving" class="flex items-center gap-1 text-xs text-muted">
            <UIcon name="i-lucide-loader-2" class="animate-spin" />
            {{ t("groups.permissions.saving") }}
          </span>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <p class="text-sm font-medium">{{ t("accounts.invite.groupPerms.permsLabel", { domain: domainLabel ?? "" }) }}</p>
            <p class="text-xs text-muted">{{ t("groups.permissions.autosaveHint") }}</p>
          </div>
          <GroupPermissionResourceBlock
            v-for="resource in domainResources"
            :key="resource"
            :resource="resource"
            :label="resourceLabels[resource] ?? resource"
            :actions="actionsByResource[resource] ?? []"
            :action-labels="actionLabelsFor('domain', resource, actionsByResource[resource] ?? [])"
            :permissions="currentSet"
            @toggle="(action, checked) => toggle(resource, action, checked)"
            @check-all="(checked) => checkAllResource(resource, checked)"
          />
        </div>
      </template>
    </div>
  </UCard>
</template>
