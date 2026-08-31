<script setup lang="ts">
// The account a mailbox or an alias belongs to, as a list cell: its address,
// linking to the account behind it. Shared by the recipients and the aliases
// tables, which show the same thing off the same two fields.
//
// The link is only offered to someone allowed to open that page, so the click
// never lands on a 403; everyone else reads the address as plain text. A row
// belonging to nobody says so rather than leaving an empty cell to be read as a
// loading gap.
defineProps<{ ownerId: string | null; ownerEmail: string | null }>();

const { t } = useI18n();
const { isRoot, hasGlobal } = usePermissions();

const canViewAccount = computed(() => isRoot.value || (hasGlobal("accounts", "access") && hasGlobal("accounts", "view-account")));
</script>

<template>
  <span v-if="!ownerId || !ownerEmail" class="text-dimmed">{{ t("mailboxOwner.unassigned") }}</span>

  <FullTooltip v-else :text="ownerEmail">
    <NuxtLink v-if="canViewAccount" :to="`/admin/accounts/${ownerId}`" class="font-medium text-primary hover:underline">
      {{ truncateChars(ownerEmail, 32) }}
    </NuxtLink>
    <span v-else>{{ truncateChars(ownerEmail, 32) }}</span>
  </FullTooltip>
</template>
