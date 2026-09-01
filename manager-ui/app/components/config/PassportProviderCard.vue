<script setup lang="ts">
const emit = defineEmits<{
  save: [{ clientId: string; clientSecret?: string; enabled: boolean }];
  forget: [];
}>();

const props = defineProps<{
  provider: PassportProviderRow;
  saving: boolean;
  /** External sign-in is off server-wide: nothing here can take effect. */
  disabled: boolean;
}>();

const { t } = useI18n();
const toast = useToast();

const open = ref(false);
const forgetOpen = ref(false);
const clientId = ref(props.provider.clientId);
// Left empty on a configured provider: the stored secret is never sent back, so
// an empty field means "keep the one you have" rather than "clear it".
const clientSecret = ref("");

const secretRequired = computed(() => !props.provider.configured);
const canSave = computed(
  () => clientId.value.trim().length > 0 && (!secretRequired.value || clientSecret.value.trim().length > 0) && !props.saving
);

// The stored client id is echoed back by every save, so the field follows it
// rather than keeping whatever was typed before the server answered.
watch(
  () => props.provider.clientId,
  (v) => (clientId.value = v)
);

// A provider that has nothing yet opens on its form, since there is nothing to
// look at otherwise; a configured one stays folded.
watchEffect(() => {
  if (!props.provider.configured) open.value = true;
});

function save() {
  if (!canSave.value) return;
  const secret = clientSecret.value.trim();
  emit("save", {
    clientId: clientId.value.trim(),
    clientSecret: secret || undefined,
    enabled: props.provider.enabled,
  });
  clientSecret.value = "";
}

function toggle(enabled: boolean) {
  if (!props.provider.configured) return;
  emit("save", { clientId: props.provider.clientId, enabled });
}

function toggleOpen() {
  open.value = !open.value;
}

function askForget() {
  forgetOpen.value = true;
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value);
  toast.add({ title: t("config.passport.copied"), color: "success", icon: "i-lucide-check" });
}
</script>

<template>
  <div class="rounded-lg border border-default">
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="min-w-0">
        <p class="font-medium truncate">{{ provider.label }}</p>
        <p class="text-sm text-muted">
          {{ provider.configured ? t("config.passport.configured") : t("config.passport.notConfigured") }}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          :icon="open ? 'i-lucide-chevron-up' : 'i-lucide-settings'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleOpen"
        >
          {{ open ? t("config.passport.close") : t("config.passport.configure") }}
        </UButton>
        <USwitch
          :model-value="provider.enabled"
          :disabled="!provider.configured || disabled || saving"
          @update:model-value="toggle"
        />
      </div>
    </div>

    <div v-if="open" class="border-t border-default p-4 space-y-4">
      <UAlert
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        :title="t('config.passport.consoleTitle', { provider: provider.label })"
        :description="t('config.passport.consoleHint', { provider: provider.label })"
      />

      <div class="space-y-3">
        <UFormField :label="t('config.passport.javascriptOrigin')">
          <UButtonGroup class="w-full">
            <UInput :model-value="provider.javascriptOrigin" readonly class="w-full font-mono text-xs" />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              :aria-label="t('config.passport.copy')"
              @click="copy(provider.javascriptOrigin)"
            />
          </UButtonGroup>
        </UFormField>

        <UFormField :label="t('config.passport.redirectUri')">
          <UButtonGroup class="w-full">
            <UInput :model-value="provider.redirectUri" readonly class="w-full font-mono text-xs" />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              :aria-label="t('config.passport.copy')"
              @click="copy(provider.redirectUri)"
            />
          </UButtonGroup>
        </UFormField>
      </div>

      <USeparator />

      <UFormField :label="t('config.passport.clientId')" required>
        <UInput v-model="clientId" class="w-full font-mono text-xs" autocomplete="off" />
      </UFormField>

      <UFormField
        :label="t('config.passport.clientSecret')"
        :hint="provider.configured ? t('config.passport.clientSecretKeep') : undefined"
        :required="secretRequired"
      >
        <PasswordInput v-model="clientSecret" autocomplete="off" class="w-full font-mono text-xs" />
      </UFormField>

      <div class="flex justify-between gap-2">
        <UButton
          v-if="provider.configured"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="saving"
          @click="askForget"
        >
          {{ t("config.passport.forget") }}
        </UButton>
        <span v-else />
        <UButton icon="i-lucide-check" color="primary" :disabled="!canSave" :loading="saving" @click="save">
          {{ t("config.passport.saveCredentials") }}
        </UButton>
      </div>
    </div>

    <ConfirmModal
      v-model:open="forgetOpen"
      :title="t('config.passport.forgetTitle', { provider: provider.label })"
      :description="t('config.passport.forgetHint', { provider: provider.label })"
      @confirm="emit('forget')"
    />
  </div>
</template>
