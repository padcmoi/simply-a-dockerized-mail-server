<script setup lang="ts">
const emit = defineEmits<{ saved: [settings: DmarcSettings] }>();
const props = defineProps<{ settings: DmarcSettings; mailboxes: string[] }>();

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const toast = useToast();

const saving = ref(false);
const form = reactive<DmarcSettings>({ ...props.settings, inboxes: [...props.settings.inboxes] });

const hours = Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, value: hour }));

const valid = computed(
  () => Number.isInteger(form.retentionDays) && form.retentionDays >= 7 && form.retentionDays <= 3650 && form.inboxes.length <= 10
);

watch(
  () => props.settings,
  (value) => Object.assign(form, { ...value, inboxes: [...value.inboxes] })
);

async function save() {
  saving.value = true;
  try {
    const saved = await call<DmarcSettings>("/dmarc/settings", {
      method: "PUT",
      body: { ...form },
    });
    toast.add({ title: t("dmarc.settings.saved"), color: "success", icon: "i-lucide-check" });
    emit("saved", saved);
  } catch (e) {
    toast.add({ title: t("dmarc.settings.saveFailed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("dmarc.settings.title") }}</h2>
    </template>

    <div class="space-y-6">
      <UFormField :label="t('dmarc.settings.sending')" name="sendingEnabled" :description="t('dmarc.settings.sendingHint')">
        <USwitch v-model="form.sendingEnabled" />
      </UFormField>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UFormField :label="t('dmarc.settings.hour')" name="reportHour" :description="t('dmarc.settings.hourHint')">
          <USelect v-model="form.reportHour" :items="hours" class="w-full" />
        </UFormField>

        <UFormField :label="t('dmarc.settings.retention')" name="retentionDays" :description="t('dmarc.settings.retentionHint')">
          <UInput v-model.number="form.retentionDays" type="number" :min="7" :max="3650" class="w-full" />
        </UFormField>
      </div>

      <UFormField :label="t('dmarc.settings.inboxes')" name="inboxes" :description="t('dmarc.settings.inboxesHint')">
        <USelectMenu
          v-model="form.inboxes"
          :items="mailboxes"
          multiple
          icon="i-lucide-mailbox"
          :placeholder="t('dmarc.settings.inboxesPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <div class="flex justify-end">
        <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
          {{ t("dmarc.settings.save") }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
