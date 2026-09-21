<script setup lang="ts">
export type DmarcSection = "overview" | "received" | "sent" | "inbox" | "settings";

const { active } = defineProps<{ active: DmarcSection }>();

const { t } = useI18n();
const { canManage } = useDmarcAccess();

const TARGETS: Record<DmarcSection, { to: string; icon: string }> = {
  overview: { to: "/admin/dmarc", icon: "i-lucide-layout-dashboard" },
  received: { to: "/admin/dmarc/received", icon: "i-lucide-inbox" },
  sent: { to: "/admin/dmarc/sent", icon: "i-lucide-send" },
  inbox: { to: "/admin/dmarc/inbox", icon: "i-lucide-mailbox" },
  settings: { to: "/admin/dmarc/settings", icon: "i-lucide-sliders-horizontal" },
};

const items = computed(() =>
  (Object.keys(TARGETS) as DmarcSection[])
    .filter((section) => section !== "settings" || canManage.value)
    .map((section) => ({ section, label: t(`dmarc.sections.${section}`), ...TARGETS[section] }))
);
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
    <UCard
      v-for="item in items"
      :key="item.section"
      :ui="{ root: item.section === active ? 'ring-2 ring-primary' : 'transition hover:shadow-lg cursor-pointer' }"
      @click="item.section !== active && navigateTo(item.to)"
    >
      <div class="flex items-center gap-3">
        <UIcon :name="item.icon" class="text-xl shrink-0" :class="item.section === active ? 'text-primary' : 'text-muted'" />
        <span class="font-medium truncate min-w-0" :class="item.section === active ? 'text-primary' : ''">{{ item.label }}</span>
      </div>
    </UCard>
  </div>
</template>
