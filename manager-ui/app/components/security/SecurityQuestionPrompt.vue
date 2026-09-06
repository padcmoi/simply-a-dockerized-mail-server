<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

// The account has signed in and has no security question. It cannot be closed:
// no click outside, no escape, no cross. Filling it in is the way out, because
// a question nobody was ever made to answer is a fallback that does not exist
// on the day it is needed. Signing out is the only other door, so a save that
// keeps failing never traps anyone.
const { t } = useI18n();
const auth = useAuthStore();
const { form, loading, answered, options, canSubmit, saving, onAnswer, submit } = useSecurityQuestion();

const confirmOpen = ref(false);

// A void wrapper: an inline assignment in a click handler returns the assigned
// value, which Vue's void handler type refuses.
function askConfirm() {
  confirmOpen.value = true;
}

// Read from the API, never from the session: the flag the session carries was
// true when it opened and stays true after an administrator clears the
// question, which would leave the account facing a wall of refusals with no
// window telling it why. The status route is one of the three the guard lets
// through, so this answer always arrives.
const open = computed(() => auth.isAuthenticated && answered.value === false);

async function signOut() {
  await auth.logout();
  await navigateTo("/login");
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="false"
    :close="false"
    :title="t('profile.securityQuestionPrompt.title')"
    :description="t('profile.securityQuestionPrompt.hint')"
  >
    <template #body>
      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-9 w-full" />
      </div>

      <form v-else class="space-y-4" @submit.prevent="askConfirm">
        <UFormField :label="t('profile.securityQuestionPage.question')" required>
          <USelect
            v-model="form.question"
            :items="options"
            value-key="value"
            :placeholder="t('profile.securityQuestionPage.questionPlaceholder')"
            class="w-full"
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
            class="w-full"
            required
            @update:model-value="onAnswer(String($event))"
          />
        </UFormField>

        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('profile.securityQuestionPage.immutableWarning')"
        />
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" size="sm" @click="signOut">
          {{ t("layout.signOut") }}
        </UButton>
        <UButton icon="i-lucide-shield-check" :disabled="!canSubmit" :loading="saving" @click="askConfirm">
          {{ t("profile.securityQuestionPage.submit") }}
        </UButton>
      </div>
    </template>
  </UModal>

  <ConfirmModal
    v-model:open="confirmOpen"
    type="warning"
    :title="t('profile.securityQuestionPage.confirmTitle')"
    :description="t('profile.securityQuestionPage.confirmDescription')"
    @confirm="submit"
  />
</template>
