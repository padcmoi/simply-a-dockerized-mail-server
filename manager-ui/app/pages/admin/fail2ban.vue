<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "fail2ban", action: "access" },
    { resource: "fail2ban", action: "view-fail2ban-jails" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { isRoot, hasGlobal } = usePermissions();

setBreadcrumb([{ label: t("nav.fail2ban") }]);

const { status, failed, busy, ban, unban } = useFail2ban();

const canBan = computed(() => isRoot.value || hasGlobal("fail2ban", "ban-ip"));
const canUnban = computed(() => isRoot.value || hasGlobal("fail2ban", "unban-ip"));
const jailNames = computed(() => status.value?.jails.map((jail) => jail.name) ?? []);
const columns = computed(() => (jailNames.value.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"));

const form = useTemplateRef<{ clear: () => void }>("form");

async function onBan(ip: string) {
  if (await ban(ip)) form.value?.clear();
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-shield-ban"
      :title="t('fail2ban.title')"
      :description="t('fail2ban.subtitle')"
    />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('fail2ban.loadFailed')" />

    <div v-if="!status && !failed" class="grid gap-4 lg:grid-cols-2">
      <UCard v-for="card in 2" :key="card">
        <div class="space-y-3">
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-24 w-full" />
        </div>
      </UCard>
    </div>

    <UAlert
      v-else-if="status && !status.available"
      color="warning"
      variant="subtle"
      icon="i-lucide-unplug"
      :title="t('fail2ban.unavailable')"
    />

    <template v-else-if="status">
      <Fail2banBanForm v-if="canBan" ref="form" :busy="busy" @ban="onBan" />

      <div class="grid items-stretch gap-4" :class="columns">
        <Fail2banJailCard
          v-for="jail in status.jails"
          :key="jail.name"
          :jail="jail"
          :can-unban="canUnban"
          :busy="busy"
          @unban="(ip) => unban(jail.name, ip)"
        />
      </div>

      <Fail2banHistory :history="status.history" />
    </template>
  </div>
</template>
