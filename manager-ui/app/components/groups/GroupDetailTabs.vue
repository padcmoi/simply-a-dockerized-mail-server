<script setup lang="ts">
type Section = "info" | "owner" | "members" | "application" | "domain";

const props = defineProps<{
  groupId: number;
  active: Section;
  // The "info" card shows the group's own name instead of a generic label
  // -- it's the group's identity, not just a settings section.
  groupName: string;
  // FQDN of the currently viewed domain, shown as a subtitle on the
  // "domain" card so it's clear which domain is being edited, not just that
  // the Domaine section is active.
  domainLabel?: string;
}>();

const { t } = useI18n();

// Same quick-link card look as domains/[domain]/index.vue's Recipients/
// Aliases/Quotas/Administration row -- UTabs' pill list can't fit 5 items
// (translated labels truncate hard, no wrap) so this reuses the card grid
// pattern instead, which is already responsive down to a single column.
const items = computed(() => [
  { value: "info" as const, label: props.groupName, icon: "i-lucide-info" },
  { value: "owner" as const, label: t("groups.detail.tabs.owner"), icon: "i-lucide-crown" },
  { value: "members" as const, label: t("groups.detail.tabs.members"), icon: "i-lucide-users" },
  { value: "application" as const, label: t("groups.detail.tabs.application"), icon: "i-lucide-shield-alert" },
  { value: "domain" as const, label: t("groups.detail.tabs.domain"), icon: "i-lucide-globe" },
]);

// "info" is the group's default landing route (/groups/:id, no own
// segment); owner/members sit directly under it; the 2 permission sections
// are namespaced under /acl to keep them visually grouped and distinct from
// the group's own settings.
function targetFor(section: Section) {
  const base = `/groups/${props.groupId}`;
  if (section === "info") return base;
  if (section === "application") return `${base}/acl/app`;
  if (section === "domain") return `${base}/acl/domain`;
  return `${base}/${section}`;
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard
      v-for="item in items"
      :key="item.value"
      :ui="{ root: item.value === active ? 'ring-2 ring-primary' : 'transition hover:shadow-lg cursor-pointer' }"
      @click="item.value !== active && navigateTo(targetFor(item.value))"
    >
      <div class="flex items-center gap-3">
        <UIcon :name="item.icon" class="text-xl shrink-0" :class="item.value === active ? 'text-primary' : 'text-muted'" />
        <div v-if="item.value === 'domain' && domainLabel" class="min-w-0">
          <span class="font-medium block truncate" :class="item.value === active ? 'text-primary' : ''">{{ item.label }}</span>
          <span class="text-xs text-muted truncate block">{{ domainLabel }}</span>
        </div>
        <span v-else class="font-medium truncate min-w-0" :class="item.value === active ? 'text-primary' : ''">{{
          item.label
        }}</span>
        <UIcon v-if="item.value !== active" name="i-lucide-arrow-right" class="ml-auto text-muted shrink-0" />
      </div>
    </UCard>
  </div>
</template>
