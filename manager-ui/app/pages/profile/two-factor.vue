<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { formatDateTime } = useDateTime();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.twoFactorPage.breadcrumb") }]);

// The three moments of turning it on: nothing yet, the secret shown and
// waiting for its first code, and the recovery codes shown once.
const setup = ref<{ secret: string; otpauthUri: string } | null>(null);
const recoveryCodes = ref<string[] | null>(null);
const enableCode = ref("");
const regenerateCode = ref("");
const disableCode = ref("");
const busy = ref<"setup" | "enable" | "regenerate" | "disable" | null>(null);
const copied = ref(false);
// The two six-digit fields answer a refused code themselves: shaken and emptied.
const enableOtp = useTemplateRef<{ reject: () => Promise<void> }>("enableOtp");
const regenerateOtp = useTemplateRef<{ reject: () => Promise<void> }>("regenerateOtp");
const disableOtp = useTemplateRef<{ reject: () => Promise<void> }>("disableOtp");
// Turning off takes either kind of code, and they are not typed the same way:
// six digits go in the cells, a recovery code in a field with a button.
const disableMode = ref<"otp" | "recovery">("otp");

const {
  data: status,
  status: statusState,
  refresh,
} = useAsyncData("two-factor-status", () => call<TwoFactorStatus>("/auth/jwt/me/two-factor"), { server: false });
const loading = computed(() => statusState.value !== "success" && statusState.value !== "error");
const enabled = computed(() => status.value?.enabled === true);

const secretGroups = computed(() => setup.value?.secret.match(/.{1,4}/g)?.join(" ") ?? "");
const disableModeItems = computed(() => [
  { value: "otp", label: t("profile.twoFactorPage.codeFromApp") },
  { value: "recovery", label: t("profile.twoFactorPage.recoveryCode") },
]);

watch(disableMode, () => {
  disableCode.value = "";
});

async function startSetup() {
  busy.value = "setup";
  try {
    setup.value = await call<{ secret: string; otpauthUri: string }>("/auth/jwt/me/two-factor/setup", { method: "POST" });
    enableCode.value = "";
  } catch (err) {
    toast.add({ title: t("profile.twoFactorPage.setupFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    busy.value = null;
  }
}

async function enable() {
  if (enableCode.value.trim().length < 6) return;
  busy.value = "enable";
  try {
    const answer = await call<{ recoveryCodes: string[] }>("/auth/jwt/me/two-factor/enable", {
      method: "POST",
      body: { code: enableCode.value },
    });
    setup.value = null;
    recoveryCodes.value = answer.recoveryCodes;
    toast.add({ title: t("profile.twoFactorPage.enabled"), color: "success" });
    await refresh();
  } catch (err) {
    await enableOtp.value?.reject();
    toast.add({ title: t("profile.twoFactorPage.failed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    busy.value = null;
  }
}

async function regenerate() {
  if (regenerateCode.value.trim().length < 6) return;
  busy.value = "regenerate";
  try {
    const answer = await call<{ recoveryCodes: string[] }>("/auth/jwt/me/two-factor/recovery-codes", {
      method: "POST",
      body: { code: regenerateCode.value },
    });
    regenerateCode.value = "";
    recoveryCodes.value = answer.recoveryCodes;
    await refresh();
  } catch (err) {
    await regenerateOtp.value?.reject();
    toast.add({ title: t("profile.twoFactorPage.failed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    busy.value = null;
  }
}

async function disable() {
  if (disableCode.value.trim().length < 6) return;
  busy.value = "disable";
  try {
    await call("/auth/jwt/me/two-factor", { method: "DELETE", body: { code: disableCode.value } });
    disableCode.value = "";
    recoveryCodes.value = null;
    toast.add({ title: t("profile.twoFactorPage.disabled"), color: "success" });
    await refresh();
  } catch (err) {
    if (disableMode.value === "otp") await disableOtp.value?.reject();
    else disableCode.value = "";
    toast.add({ title: t("profile.twoFactorPage.failed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    busy.value = null;
  }
}

function dismissCodes() {
  recoveryCodes.value = null;
}

function cancelSetup() {
  setup.value = null;
}

async function copyCodes() {
  if (!recoveryCodes.value) return;
  await navigator.clipboard.writeText(recoveryCodes.value.join("\n"));
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-smartphone"
      :title="t('profile.twoFactorPage.alertTitle')"
      :description="t('profile.twoFactorPage.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-smartphone" class="size-4 text-muted" />
            {{ t("profile.twoFactor") }}
          </h2>
          <USkeleton v-if="loading" class="h-6 w-40" />
          <UBadge
            v-else
            :color="enabled ? 'success' : 'neutral'"
            variant="subtle"
            :icon="enabled ? 'i-lucide-shield-check' : 'i-lucide-shield-off'"
          >
            {{
              enabled
                ? t("profile.twoFactorPage.statusOn", { date: formatDateTime(status?.enabledAt ?? "") })
                : t("profile.twoFactorPage.statusOff")
            }}
          </UBadge>
        </div>
      </template>

      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-9 w-full sm:max-w-sm" />
      </div>

      <div v-else-if="recoveryCodes" class="space-y-4">
        <div>
          <h3 class="font-medium">{{ t("profile.twoFactorPage.recoveryTitle") }}</h3>
          <p class="text-sm text-muted">{{ t("profile.twoFactorPage.recoveryIntro") }}</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-sm">
          <span v-for="code in recoveryCodes" :key="code" class="rounded-md bg-elevated px-3 py-2 text-center tabular-nums">
            {{ code }}
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="subtle" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyCodes">
            {{ copied ? t("profile.twoFactorPage.copied") : t("profile.twoFactorPage.copy") }}
          </UButton>
          <UButton icon="i-lucide-check" @click="dismissCodes">{{ t("profile.twoFactorPage.done") }}</UButton>
        </div>
      </div>

      <template v-else-if="!enabled">
        <div v-if="!setup" class="space-y-4">
          <p class="text-sm text-muted">{{ t("profile.twoFactorHint") }}</p>
          <UButton icon="i-lucide-shield-plus" :loading="busy === 'setup'" @click="startSetup">
            {{ t("profile.twoFactorPage.start") }}
          </UButton>
        </div>

        <div v-else class="space-y-4">
          <div>
            <h3 class="font-medium">{{ t("profile.twoFactorPage.enableTitle") }}</h3>
            <p class="text-sm text-muted">{{ t("profile.twoFactorPage.enableIntro") }}</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-6 items-start">
            <TwoFactorQr :value="setup.otpauthUri" />
            <div class="space-y-4 min-w-0 flex-1">
              <div>
                <p class="text-sm text-muted">{{ t("profile.twoFactorPage.manualEntry") }}</p>
                <code class="block mt-1 font-mono text-sm break-all select-all">{{ secretGroups }}</code>
              </div>
              <div class="space-y-4">
                <UFormField :label="t('profile.twoFactorPage.codeFromApp')" required>
                  <OtpInput ref="enableOtp" v-model="enableCode" autofocus :disabled="busy === 'enable'" @complete="enable" />
                </UFormField>
                <UButton color="neutral" variant="ghost" :disabled="busy === 'enable'" @click="cancelSetup">
                  {{ t("common.cancel") }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="space-y-6">
        <p class="text-sm text-muted">
          {{ t("profile.twoFactorPage.recoveryLeft", { count: status?.recoveryCodesLeft ?? 0 }) }}
        </p>

        <div class="space-y-3">
          <div>
            <h3 class="font-medium">{{ t("profile.twoFactorPage.regenerateTitle") }}</h3>
            <p class="text-sm text-muted">{{ t("profile.twoFactorPage.regenerateHint") }}</p>
          </div>
          <UFormField :label="t('profile.twoFactorPage.codeFromApp')" required>
            <OtpInput ref="regenerateOtp" v-model="regenerateCode" :disabled="busy === 'regenerate'" @complete="regenerate" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-3">
          <div>
            <h3 class="font-medium">{{ t("profile.twoFactorPage.disableTitle") }}</h3>
            <p class="text-sm text-muted">{{ t("profile.twoFactorPage.disableHint") }}</p>
          </div>
          <URadioGroup v-model="disableMode" orientation="horizontal" :items="disableModeItems" :disabled="busy === 'disable'" />
          <UFormField v-if="disableMode === 'otp'" :label="t('profile.twoFactorPage.codeFromApp')" required>
            <OtpInput ref="disableOtp" v-model="disableCode" :disabled="busy === 'disable'" @complete="disable" />
          </UFormField>
          <form v-else class="flex flex-col sm:flex-row gap-2 sm:items-end" @submit.prevent="disable">
            <UFormField :label="t('profile.twoFactorPage.recoveryCode')" required>
              <UInput
                v-model="disableCode"
                autocomplete="one-time-code"
                maxlength="16"
                placeholder="XXXXX-XXXXX"
                icon="i-lucide-key-round"
                class="w-full sm:w-56"
              />
            </UFormField>
            <UButton
              type="submit"
              color="error"
              variant="subtle"
              icon="i-lucide-shield-off"
              :disabled="disableCode.trim().length < 6"
              :loading="busy === 'disable'"
            >
              {{ t("profile.twoFactorPage.disable") }}
            </UButton>
          </form>
        </div>
      </div>
    </UCard>
  </div>
</template>
