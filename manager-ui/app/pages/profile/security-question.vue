<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { form, loading, isSet, options, chosenLabel, canSubmit, saving, onAnswer, submit } = useSecurityQuestion();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.securityQuestionPage.breadcrumb") }]);

const confirmOpen = ref(false);

// A void wrapper: an inline assignment in a click handler returns the assigned
// value, which Vue's void handler type refuses.
function askConfirm() {
  confirmOpen.value = true;
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-shield-question-mark"
      :title="t('profile.securityQuestionPage.alertTitle')"
      :description="t('profile.securityQuestionPage.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-shield-question-mark" class="size-4 text-muted" />
            {{ t("profile.securityQuestionPage.title") }}
          </h2>
          <USkeleton v-if="loading" class="h-5 w-24" />
          <UBadge v-else :color="isSet ? 'success' : 'warning'" variant="subtle">
            {{ isSet ? t("profile.securityQuestionPage.stateSet") : t("profile.securityQuestionPage.stateUnset") }}
          </UBadge>
        </div>
      </template>

      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-9 w-full sm:max-w-lg" />
      </div>

      <!-- Set is set: the question is shown, and nothing here can change it. -->
      <div v-else-if="isSet" class="space-y-4">
        <UFormField :label="t('profile.securityQuestionPage.question')">
          <UInput :model-value="chosenLabel" readonly disabled class="w-full sm:max-w-lg" />
        </UFormField>
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :description="t('profile.securityQuestionPage.immutableNotice')"
        />
      </div>

      <form v-else class="space-y-4" @submit.prevent="askConfirm">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('profile.securityQuestionPage.immutableWarning')"
        />

        <UFormField :label="t('profile.securityQuestionPage.question')" required>
          <USelect
            v-model="form.question"
            :items="options"
            value-key="value"
            :placeholder="t('profile.securityQuestionPage.questionPlaceholder')"
            class="w-full sm:max-w-lg"
          />
        </UFormField>

        <UFormField
          :label="t('profile.securityQuestionPage.answer')"
          :hint="t('profile.securityQuestionPage.answerHint')"
          required
        >
          <UInput
            :model-value="form.answer"
            maxlength="255"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            class="w-full sm:max-w-lg"
            required
            @update:model-value="onAnswer(String($event))"
          />
        </UFormField>
      </form>

      <template v-if="!isSet && !loading" #footer>
        <div class="flex justify-end">
          <UButton icon="i-lucide-shield-check" :disabled="!canSubmit" :loading="saving" @click="askConfirm">
            {{ t("profile.securityQuestionPage.submit") }}
          </UButton>
        </div>
      </template>
    </UCard>

    <ConfirmModal
      v-model:open="confirmOpen"
      type="warning"
      :title="t('profile.securityQuestionPage.confirmTitle')"
      :description="t('profile.securityQuestionPage.confirmDescription')"
      @confirm="submit"
    />
  </div>
</template>
