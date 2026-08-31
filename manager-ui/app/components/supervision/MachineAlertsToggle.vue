<script setup lang="ts">
// Green bell on, red crossed-out bell off, in the header of the section it is
// about. It switches the same preference as the `Machine` row of the profile,
// and only its in-app half: what reaches a mailbox stays a decision taken there.
const { t } = useI18n();
const toast = useToast();
const { enabled, saving, read, toggle } = useMachineAlerts();

const { status } = await useAsyncData("machine-alerts", () => read());

async function onClick() {
  const wanted = !enabled.value;
  if (await toggle()) {
    toast.add({
      title: t(wanted ? "supervision.alertsOn" : "supervision.alertsOff"),
      color: "success",
      icon: "i-lucide-check",
    });
    return;
  }
  toast.add({ title: t("common.error"), color: "error", icon: "i-lucide-triangle-alert" });
}
</script>

<template>
  <USkeleton v-if="status === 'pending'" class="h-8 w-8 rounded-md" />

  <UTooltip v-else :text="t(enabled ? 'supervision.alertsEnabled' : 'supervision.alertsDisabled')">
    <UButton
      :icon="enabled ? 'i-lucide-bell' : 'i-lucide-bell-off'"
      :color="enabled ? 'success' : 'error'"
      :aria-label="t(enabled ? 'supervision.alertsEnabled' : 'supervision.alertsDisabled')"
      :loading="saving"
      variant="subtle"
      size="sm"
      @click="onClick"
    />
  </UTooltip>
</template>
