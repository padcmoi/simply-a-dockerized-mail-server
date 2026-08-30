<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "invite-account" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts"), to: "/admin/accounts" }, { label: t("accounts.invite.byEmail") }]);

const {
  email,
  domainId,
  selectedGroupIds,
  selectedRecipientIds,
  selectedAliasIds,
  makeOwner,
  ownerConfirmOpen,
  useDomainGroup,
  sending,
  canAssignRecipient,
  canAssignAlias,
  recipientAssignOptions,
  aliasAssignOptions,
  domainOptions,
  groupOptions,
  selectedDomain,
  currentOwnerEmail,
  canMakeOwner,
  mailEnabled,
  canSubmit,
  onToggleOwner,
  confirmOwner,
  submit,
  loadGroups,
} = useAccountInvite();
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-mail"
      :title="t('accounts.invite.emailAlertTitle')"
      :description="t('accounts.invite.emailAlertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UAlert
      v-if="!mailEnabled"
      icon="i-lucide-mail-x"
      color="warning"
      variant="subtle"
      :description="t('config.mailOffNotice')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <form class="space-y-6" @submit.prevent="submit">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("accounts.invite.byEmail") }}</h2>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('accounts.invite.emailLabel')" required>
            <UInput
              v-model="email"
              type="email"
              icon="i-lucide-mail"
              placeholder="jane@example.com"
              autocomplete="off"
              class="w-full"
              required
            />
          </UFormField>

          <UFormField :label="t('accounts.invite.domainLabel')" required>
            <USelectMenu
              v-model="domainId"
              value-key="value"
              icon="i-lucide-globe"
              :items="domainOptions"
              :placeholder="t('accounts.invite.domainPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('accounts.invite.groupsLabel')" class="sm:col-span-2">
            <USelectMenu
              v-model="selectedGroupIds"
              multiple
              value-key="value"
              icon="i-lucide-users-round"
              :items="groupOptions"
              :placeholder="t('accounts.invite.groupsPlaceholder')"
              class="w-full"
            />
            <p class="text-xs text-muted mt-1.5">{{ t("accounts.invite.groupsHint") }}</p>
          </UFormField>
        </div>
      </UCard>

      <UCard v-if="domainId !== undefined && (canAssignRecipient || canAssignAlias)">
        <template #header>
          <h2 class="font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-user-plus" class="size-4 text-muted" />
            {{ t("accounts.invite.assignSectionTitle") }}
          </h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">{{ t("accounts.invite.assignHint") }}</p>
          <UFormField v-if="canAssignRecipient" :label="t('accounts.invite.assignRecipients')">
            <USelectMenu
              v-model="selectedRecipientIds"
              multiple
              value-key="value"
              icon="i-lucide-users"
              :items="recipientAssignOptions"
              :placeholder="t('accounts.invite.assignRecipientsPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="canAssignAlias" :label="t('accounts.invite.assignAliases')">
            <USelectMenu
              v-model="selectedAliasIds"
              multiple
              value-key="value"
              icon="i-lucide-at-sign"
              :items="aliasAssignOptions"
              :placeholder="t('accounts.invite.assignAliasesPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard v-if="domainId !== undefined">
        <template #header>
          <h2 class="font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-crown" class="size-4 text-muted" />
            {{ t("accounts.invite.ownerSectionTitle") }}
          </h2>
        </template>

        <div class="space-y-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted">{{ t("accounts.invite.currentOwnerLabel") }}</span>
            <UBadge v-if="currentOwnerEmail" color="neutral" variant="subtle">{{ currentOwnerEmail }}</UBadge>
            <span v-else class="text-muted italic">{{ t("accounts.invite.noOwner") }}</span>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ t("accounts.invite.makeOwnerLabel") }}</p>
              <p class="text-xs text-muted mt-0.5">{{ t("accounts.invite.makeOwnerHint") }}</p>
              <p v-if="!canMakeOwner" class="text-xs text-warning mt-1 flex items-center gap-1">
                <UIcon name="i-lucide-lock" class="size-3.5 shrink-0" />
                {{ t("accounts.invite.makeOwnerNoRight") }}
              </p>
            </div>
            <USwitch :model-value="makeOwner" :disabled="!canMakeOwner" @update:model-value="onToggleOwner" />
          </div>
        </div>
      </UCard>

      <InviteDomainGroupCard
        v-model:enabled="useDomainGroup"
        :domain-id="domainId"
        :domain-label="selectedDomain?.domain"
        @created="loadGroups"
      />

      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" to="/admin/accounts">{{ t("common.cancel") }}</UButton>
        <UButton type="submit" color="primary" icon="i-lucide-send" :loading="sending" :disabled="!canSubmit">
          {{ t("accounts.invite.submit") }}
        </UButton>
      </div>
    </form>

    <ConfirmModal
      v-model:open="ownerConfirmOpen"
      type="warning"
      :title="t('accounts.invite.makeOwnerConfirmTitle')"
      :description="t('accounts.invite.makeOwnerConfirmDescription')"
      @confirm="confirmOwner"
    />
  </div>
</template>
