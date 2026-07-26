<script setup lang="ts">
import type { AccountOption } from "~/composables/useAccountOptions";

const emit = defineEmits<{ changed: [] }>();

const props = defineProps<{
  kind: "recipients" | "aliases";
  domainId: number;
  resourceId: number;
  ownerEmail: string | null;
  canAssign: boolean;
  canUnassign: boolean;
}>();

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const toast = useToast();
const { options, searchTerm, loading, search } = useAccountOptions();

// Bound to the whole option object (not value-key): the picker then displays the
// account's own label, which a value-key binding cannot resolve once the
// typeahead has narrowed `options` past the selected row (it fell back to the id).
const picked = ref<AccountOption | undefined>(undefined);
const saving = ref(false);

const endpoint = computed(() => `/domains/${props.domainId}/${props.kind}/${props.resourceId}/owner`);

async function assign() {
  if (!picked.value) return;
  saving.value = true;
  try {
    await call(endpoint.value, { method: "PUT", body: { ownerId: picked.value.value } });
    toast.add({ title: t("mailboxOwner.assigned"), color: "success" });
    picked.value = undefined;
    emit("changed");
  } catch (e) {
    toast.add({ title: t("mailboxOwner.failed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    saving.value = false;
  }
}

async function detach() {
  saving.value = true;
  try {
    await call(endpoint.value, { method: "DELETE" });
    toast.add({ title: t("mailboxOwner.detached"), color: "success" });
    emit("changed");
  } catch (e) {
    toast.add({ title: t("mailboxOwner.failed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (props.canAssign) void search("");
});
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="text-sm font-medium">{{ t("mailboxOwner.label") }}</p>
      <p class="text-xs text-muted mt-0.5">{{ t("mailboxOwner.hint") }}</p>
    </div>

    <div class="flex items-center gap-2 text-sm">
      <UIcon name="i-lucide-user" class="text-muted shrink-0" />
      <UBadge v-if="ownerEmail" color="neutral" variant="subtle">{{ ownerEmail }}</UBadge>
      <span v-else class="text-muted italic">{{ t("mailboxOwner.unassigned") }}</span>

      <UButton
        v-if="ownerEmail && canUnassign"
        color="error"
        variant="ghost"
        size="xs"
        icon="i-lucide-user-minus"
        :loading="saving"
        @click="detach"
      >
        {{ t("mailboxOwner.detach") }}
      </UButton>
    </div>

    <div v-if="canAssign" class="flex items-end gap-2">
      <UFormField :label="t('mailboxOwner.pickAccount')" class="flex-1">
        <USelectMenu
          v-model="picked"
          v-model:search-term="searchTerm"
          :items="options"
          :loading="loading"
          icon="i-lucide-user-plus"
          :placeholder="t('mailboxOwner.pickAccount')"
          class="w-full"
        />
      </UFormField>
      <UButton color="primary" icon="i-lucide-check" :disabled="!picked" :loading="saving" @click="assign">
        {{ t("mailboxOwner.attach") }}
      </UButton>
    </div>
  </div>
</template>
