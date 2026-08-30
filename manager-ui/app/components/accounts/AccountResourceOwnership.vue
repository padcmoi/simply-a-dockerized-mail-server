<script setup lang="ts">
const props = defineProps<{
  accountId: string;
  kind: "recipients" | "aliases";
  canAttach: boolean;
  canDetach: boolean;
}>();

const { t } = useI18n();
const { apiErrorMessage } = useApiError();
const toast = useToast();

const picked = ref<number | undefined>(undefined);
const busy = ref(false);

const accountId = computed(() => props.accountId);
const { owned, assignable, domains, domainId, loading, load, attach, detach } = useAccountOwnership(accountId, props.kind);

const domainItems = computed(() => [
  { label: t("accounts.ownership.allDomains"), value: undefined as number | undefined },
  ...domains.value.map((d) => ({ label: d.domain, value: d.id as number | undefined })),
]);

function labelOf(item: OwnedResource) {
  return props.kind === "recipients" ? (item.email ?? "") : `${item.source ?? ""} → ${item.destination ?? ""}`;
}

const assignableItems = computed(() => assignable.value.map((r) => ({ label: labelOf(r), value: r.id })));

async function onAttach() {
  if (picked.value === undefined) return;
  busy.value = true;
  try {
    await attach(picked.value);
    picked.value = undefined;
    toast.add({ title: t("accounts.ownership.assigned"), color: "success" });
  } catch (e) {
    toast.add({ title: t("accounts.ownership.failed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    busy.value = false;
  }
}

async function onDetach(itemId: number) {
  busy.value = true;
  try {
    await detach(itemId);
    toast.add({ title: t("accounts.ownership.unassigned"), color: "success" });
  } catch (e) {
    toast.add({ title: t("accounts.ownership.failed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div v-if="canAttach" class="space-y-3">
      <UFormField :label="t('accounts.ownership.filterDomain')">
        <USelectMenu v-model="domainId" value-key="value" icon="i-lucide-globe" :items="domainItems" class="w-full sm:max-w-sm" />
      </UFormField>

      <div class="flex items-end gap-2">
        <UFormField
          :label="props.kind === 'recipients' ? t('accounts.ownership.assignRecipient') : t('accounts.ownership.assignAlias')"
          class="flex-1"
        >
          <USelectMenu
            v-model="picked"
            value-key="value"
            icon="i-lucide-mailbox"
            :items="assignableItems"
            :placeholder="
              props.kind === 'recipients' ? t('accounts.ownership.searchRecipient') : t('accounts.ownership.searchAlias')
            "
            class="w-full"
          />
        </UFormField>
        <UButton color="primary" icon="i-lucide-plus" :disabled="picked === undefined" :loading="busy" @click="onAttach">
          {{ t("accounts.ownership.attach") }}
        </UButton>
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium">
        {{ props.kind === "recipients" ? t("accounts.ownership.ownedRecipients") : t("accounts.ownership.ownedAliases") }}
      </p>

      <div v-if="loading" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>

      <p v-else-if="!owned.length" class="text-sm text-muted italic">
        {{ props.kind === "recipients" ? t("accounts.ownership.noOwnedRecipients") : t("accounts.ownership.noOwnedAliases") }}
      </p>

      <ul v-else class="divide-y divide-default rounded-lg ring ring-default ring-inset">
        <li v-for="item in owned" :key="item.id" class="flex items-center justify-between gap-3 px-3 py-2">
          <div class="min-w-0">
            <p class="text-sm truncate">{{ labelOf(item) }}</p>
            <p class="text-xs text-muted truncate">{{ item.domain }}</p>
          </div>
          <UButton
            v-if="canDetach"
            color="error"
            variant="ghost"
            size="xs"
            icon="i-lucide-user-minus"
            :loading="busy"
            @click="onDetach(item.id)"
          >
            {{ t("accounts.ownership.detach") }}
          </UButton>
        </li>
      </ul>
    </div>
  </div>
</template>
