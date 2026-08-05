<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({});

const { t } = useI18n();
const toast = useToast();
const auth = useAuthStore();
const { hasGlobal, isRoot } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();
const { load, save } = useNotificationPreferences();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("notifications.title") }]);

// What each source looks like here. The sources themselves and their defaults
// come from the API; only the icon is this side's business.
const ICONS: Record<string, string> = {
  support: "i-lucide-life-buoy",
  supervision: "i-lucide-activity",
};

// A source whose pages nobody may open has nothing to offer: the machine's
// alerts are for whoever may read its live figures, which is the pair the
// supervision page itself asks for.
const VISIBLE: Record<string, () => boolean> = {
  supervision: () => isRoot.value || (hasGlobal("supervision", "access") && hasGlobal("supervision", "view-machine-metrics")),
};

const saving = ref<NotificationSource | null>(null);
const mailEnabled = computed(() => auth.session?.mailEnabled ?? true);

const { data: preferences, status } = await useAsyncData("notification-preferences", () => load());

// Driven by what the API answered rather than by a list held here: it knows its
// own sources and what each does for an account that never said anything, and
// two copies of that would eventually disagree.
const sources = computed(() =>
  Object.entries(preferences.value ?? {})
    .filter(([source]) => VISIBLE[source]?.() ?? true)
    .map(([source, channels]) => ({
      source: source as NotificationSource,
      icon: ICONS[source] ?? "i-lucide-bell",
      label: t(`notifications.source.${source}`),
      hint: t(`notifications.sourceHint.${source}`),
      channels,
    }))
);

async function update(source: NotificationSource, channel: "inApp" | "email", value: boolean) {
  const current = preferences.value?.[source] ?? { inApp: false, email: false };
  saving.value = source;
  try {
    preferences.value = await save(source, { ...current, [channel]: value });
    toast.add({ title: t("notifications.saved"), color: "success", icon: "i-lucide-check" });
  } catch {
    toast.add({ title: t("common.error"), color: "error", icon: "i-lucide-triangle-alert" });
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <UContainer class="py-6 space-y-6">
    <UAlert
      icon="i-lucide-bell"
      color="neutral"
      variant="subtle"
      :title="t('notifications.title')"
      :description="t('notifications.pageDescription')"
    />

    <UAlert
      v-if="!mailEnabled"
      icon="i-lucide-mail-x"
      color="warning"
      variant="subtle"
      :description="t('config.mailOffNotice')"
    />

    <UCard>
      <div v-if="status === 'pending'" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-16 w-full" />
      </div>

      <div v-else class="divide-y divide-default">
        <div v-for="entry in sources" :key="entry.source" class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <!-- The icon says what the source notifies about, which is what
                   stays next to the switches once the sentence below has wrapped
                   away on a narrow screen. -->
              <UTooltip :text="entry.hint">
                <UIcon :name="entry.icon" class="size-5 text-primary mt-0.5 shrink-0" />
              </UTooltip>
              <div class="min-w-0">
                <p class="font-medium">{{ entry.label }}</p>
                <p class="text-sm text-muted">{{ entry.hint }}</p>
              </div>
            </div>

            <div class="flex items-center gap-6 shrink-0">
              <UCheckbox
                :model-value="entry.channels.inApp"
                :label="t('notifications.channel.inApp')"
                :disabled="saving === entry.source"
                @update:model-value="update(entry.source, 'inApp', $event === true)"
              />
              <UCheckbox
                :model-value="entry.channels.email"
                :label="t('notifications.channel.email')"
                :disabled="saving === entry.source || !mailEnabled"
                @update:model-value="update(entry.source, 'email', $event === true)"
              />
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
