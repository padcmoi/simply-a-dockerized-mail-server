<script setup lang="ts">
import type { Domain, DkimCheckResult, DkimKey } from "~/composables/useDomainDashboard";

// Gated by the "admin" domain ACL (not the generic "domain" resource the main
// dashboard requires) -- DKIM key material and ownership transfer are
// sensitive, kept off the day-to-day dashboard on purpose.
definePageMeta({
  requiredDomain: [
    { resource: "admin", action: "access" },
    { resource: "admin", action: "view-admin-page" },
  ],
});

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const auth = useAuthStore();
const { isRoot } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();
const route = useRoute();

// Ownership transfer authorization is decided entirely server-side (root or
// current owner, see domains.controller.ts's transferOwner) -- the section
// always renders and the PATCH call is what actually enforces it (403 caught
// below). `isOwnerOrRoot` only disables the button as a UX hint so an
// obviously-doomed request isn't submitted; it grants nothing by itself.
const ownerPick = ref<string | undefined>(undefined);
const savingOwner = ref(false);
const savingActive = ref(false);
const accountOptions = ref<{ label: string; value: string }[]>([]);
// Starts true: still don't know `domain.id` at first paint (SSR + pre-mount),
// so the select must show a skeleton immediately rather than an empty
// dropdown before we've even determined whether a fetch is needed.
const ownerOptionsLoading = ref(true);

const domainFqdn = computed(() => String(route.params.domain));

const { data: domainData, refresh: refreshDomain } = useAsyncData<Domain | null>(
  "domain-admin-info",
  async () => {
    const domains = await call<Domain[]>("/domains");
    return domains.find((d) => d.domain === domainFqdn.value) ?? null;
  },
  { server: false, watch: [domainFqdn], default: () => null }
);
const domain = computed(() => domainData.value);
const domainId = computed(() => domain.value?.id ?? null);

// `immediate: false`: only makes sense once `domainId` is known -- see the
// same pattern (and its rationale) in useDomainDashboard.ts.
const {
  data: dkimData,
  status: dkimStatus,
  refresh: refreshDkim,
} = useAsyncData<DkimKey[]>(
  "domain-admin-dkim",
  async () => {
    if (!domainId.value) return [];
    try {
      return await call<DkimKey[]>(`/domains/${domainId.value}/dkim`);
    } catch {
      return [];
    }
  },
  { server: false, immediate: false, watch: [domainId], default: () => [] }
);
const dkimKeys = computed(() => dkimData.value ?? []);
const dkimLoading = computed(() => dkimStatus.value !== "success" && dkimStatus.value !== "error");

const { data: dkimCheckData, refresh: refreshDkimCheck } = useAsyncData<DkimCheckResult | null>(
  "domain-admin-dkim-check",
  async () => {
    if (!domainId.value) return null;
    try {
      return await call<DkimCheckResult>(`/domains/${domainId.value}/dkim-check`);
    } catch {
      return null;
    }
  },
  { server: false, immediate: false, watch: [domainId], default: () => null }
);
const dkimCheck = computed(() => dkimCheckData.value);

const isOwnerOrRoot = computed(
  () => isRoot.value || (domain.value?.ownerEmail != null && domain.value.ownerEmail === auth.session?.email)
);

// Each item's `slot` names the matching #<slot> template below -- same
// pattern as GroupDetailTabs/GroupPermissionsPanel's own UTabs items.
const accordionItems = computed(() => [
  { label: t("domainDashboard.status.title"), icon: "i-lucide-power", slot: "status" as const },
  { label: t("domainDashboard.dkim.title"), icon: "i-lucide-key", slot: "dkim" as const },
  { label: t("domainDashboard.owner.title"), icon: "i-lucide-crown", slot: "owner" as const },
]);

watch(
  () => domain.value?.id,
  async (id) => {
    if (id == null) return; // still don't know yet -- keep the skeleton up
    if (accountOptions.value.length) {
      ownerOptionsLoading.value = false;
      return;
    }
    ownerOptionsLoading.value = true;
    try {
      const accounts = await call<{ id: string; email: string; displayName: string | null }[]>("/accounts/names").catch(() => []);
      accountOptions.value = accounts.map((a) => ({
        label: a.displayName ? `${a.displayName} (${a.email})` : a.email,
        value: a.id,
      }));
    } finally {
      ownerOptionsLoading.value = false;
    }
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.admin") },
  ]);
});

async function rotateDkim() {
  if (!domainId.value) return;
  try {
    await call(`/domains/${domainId.value}/dkim/rotate`, { method: "POST" });
    await Promise.all([refreshDkim(), refreshDkimCheck()]);
    toast.add({ title: t("domainDashboard.dkim.toast.rotated"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("domainDashboard.dkim.toast.rotateFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

async function deleteDkim(selector: string) {
  if (!domainId.value) return;
  try {
    await call(`/domains/${domainId.value}/dkim/${selector}`, { method: "DELETE" });
    await Promise.all([refreshDkim(), refreshDkimCheck()]);
    toast.add({ title: t("domainDashboard.dkim.toast.deleted"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("domainDashboard.dkim.toast.deleteFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

async function toggleActive(value: boolean) {
  if (!domainId.value) return;
  savingActive.value = true;
  try {
    await call(`/domains/${domainId.value}/active`, { method: "PATCH", body: { active: value } });
    await refreshDomain();
    toast.add({
      title: value ? t("domainDashboard.status.activated") : t("domainDashboard.status.deactivated"),
      color: "success",
    });
  } catch (e) {
    toast.add({ title: t("domainDashboard.status.toggleFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingActive.value = false;
  }
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  toast.add({
    title: t("domainDashboard.dkim.copied"),
    icon: "i-lucide-copy",
    color: "success",
    duration: 1500,
  });
}

async function changeDomainOwner() {
  if (!domain.value || ownerPick.value === undefined) return;
  savingOwner.value = true;
  try {
    await call(`/domains/${domain.value.id}/owner`, { method: "PATCH", body: { newOwnerId: ownerPick.value } });
    await refreshDomain();
    ownerPick.value = undefined;
    toast.add({ title: t("domainDashboard.owner.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("domainDashboard.owner.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingOwner.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="warning" variant="subtle" icon="i-lucide-shield-alert" :title="t('domainDashboard.admin.subtitle')" />

    <UAccordion :items="accordionItems" :ui="{ trigger: 'py-4', body: 'pb-6' }">
      <template #status>
        <ContentPanel class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">{{ domain?.active === 1 ? t("common.active") : t("common.inactive") }}</p>
            <p class="text-xs text-muted">{{ t("domainDashboard.status.hint") }}</p>
          </div>
          <USwitch
            :model-value="domain?.active === 1"
            :loading="savingActive"
            :disabled="savingActive"
            @update:model-value="toggleActive"
          />
        </ContentPanel>
      </template>

      <template #dkim>
        <DomainDkimSection
          :keys="dkimKeys"
          :loading="dkimLoading"
          :check-result="dkimCheck"
          @rotate="rotateDkim"
          @delete="deleteDkim"
          @copy="copyToClipboard"
        />
      </template>

      <template #owner>
        <ContentPanel>
          <p class="text-sm mb-3">
            {{ t("domainDashboard.owner.current") }}:
            <span class="font-medium">{{ domain?.ownerEmail ?? t("domainDashboard.owner.unassigned") }}</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <USkeleton v-if="ownerOptionsLoading" class="h-8 w-48 rounded-md" />
            <USelectMenu
              v-else
              v-model="ownerPick"
              value-key="value"
              :items="accountOptions"
              :placeholder="t('domainDashboard.owner.pickPlaceholder')"
              class="min-w-[12rem]"
            />
            <UButton
              color="neutral"
              variant="outline"
              :loading="savingOwner"
              :disabled="ownerPick === undefined || !isOwnerOrRoot"
              @click="changeDomainOwner"
            >
              {{ t("domainDashboard.owner.change") }}
            </UButton>
          </div>
        </ContentPanel>
      </template>
    </UAccordion>
  </div>
</template>
