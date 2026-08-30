<script setup lang="ts">
const emit = defineEmits<{ created: [] }>();

// Whether the invitation must join the invitee to this domain's dedicated
// group. The parent page reads this to send `useDomainGroup` alongside the
// invite -- the backend then finds/creates the group and assigns it on
// acceptance; the group's mere existence in the DB is not a reliable signal
// on its own (it outlives any single invite), so the parent needs this.
const enabled = defineModel<boolean>("enabled", { default: false });

const props = defineProps<{
  domainId: number | undefined;
  domainLabel: string | undefined;
}>();

const { t } = useI18n();
const { domainResourceLabels: resourceLabels, actionLabelsFor } = usePermissionLabels();

const {
  saving,
  currentSet,
  imposedName,
  existingGroup,
  canManage,
  domainResources,
  actionsByResource,
  toggle,
  checkAllResource,
} = useInviteDomainGroup({
  enabled,
  domainId: () => props.domainId,
  domainLabel: () => props.domainLabel,
  onCreated: () => emit("created"),
});
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
