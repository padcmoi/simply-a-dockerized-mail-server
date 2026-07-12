<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

definePageMeta({});

const loading = ref(false);
// Groups section: every group the account belongs to, by name (invisible ones
// included -- session.groups comes from the caller's own memberships, not the
// filtered /groups list). Clicking a group opens the permissions of THAT group
// in a modal (/me/groups/:id/permissions, gated on membership, works for
// invisible groups). The "all permissions" button opens a second modal with the
// account's TOTAL effective permissions (the union across all its groups).
const permModalOpen = ref(false);
const selectedGroup = ref<{ id: string; name: string } | null>(null);
const effectiveModalOpen = ref(false);
const form = reactive({ name: "", email: "", avatarUrl: "" });

const avatarPreview = computed(() => {
  if (form.avatarUrl.trim())
    return {
      src: form.avatarUrl.trim(),
      alt: form.name || auth.session?.username || "?",
    };
  return { alt: form.name || auth.session?.username || "?" };
});

// One badge per resource (e.g. "recipients: access, read") reads far better than
// one badge per raw {resource,action} pair now that every resource carries up to
// 5 actions instead of 2.
const ACTION_ORDER = ["access", "read", "create", "modify", "delete"];

function sortActions(actions: string[]) {
  return [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
}

function openGroupPermissions(group: { id: string; name: string }) {
  selectedGroup.value = group;
  permModalOpen.value = true;
}

function openEffectivePermissions() {
  effectiveModalOpen.value = true;
}

function closeEffectivePermissions() {
  effectiveModalOpen.value = false;
}

const groupedGlobalPermissions = computed(() => {
  const byResource = new Map<string, string[]>();
  for (const p of perms.data.global) {
    byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p.action]);
  }
  return [...byResource.entries()].map(([resource, actions]) => ({
    resource,
    label: globalResourceLabels.value[resource] ?? resource,
    actions: sortActions(actions).map((a) => actionLabel("global", resource, a)),
  }));
});

const groupedDomainPermissions = computed(() => {
  const byKey = new Map<string, { domainId: number; domainName: string; resource: string; actions: string[] }>();
  for (const p of perms.data.domain) {
    const key = `${p.domainId}:${p.resource}`;
    const entry = byKey.get(key) ?? { domainId: p.domainId, domainName: p.domainName, resource: p.resource, actions: [] };
    entry.actions.push(p.action);
    byKey.set(key, entry);
  }
  return [...byKey.values()].map((entry) => ({
    domainId: entry.domainId,
    domainName: entry.domainName,
    resource: entry.resource,
    label: domainResourceLabels.value[entry.resource] ?? entry.resource,
    actions: sortActions(entry.actions).map((a) => actionLabel("domain", entry.resource, a)),
  }));
});

const { t } = useI18n();
const auth = useAuthStore();
const perms = usePermissionsStore();
const toast = useToast();
// Shared slug -> localized label mapping, same source as the group permission grid.
const { globalResourceLabels, domainResourceLabels, actionLabel } = usePermissionLabels();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("layout.profile") }]);

const schema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email(t("profile.emailInvalid")).max(255).or(z.literal("")).optional(),
  avatarUrl: z.string().url(t("profile.urlInvalid")).max(1024).or(z.literal("")).optional(),
});

async function save() {
  loading.value = true;
  try {
    await auth.updateProfile({
      name: form.name.trim() || null,
      email: form.email.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
    });
    toast.add({ title: t("profile.toast.updated"), color: "success" });
  } catch (e) {
    toast.add({
      title: t("profile.toast.updateFailed"),
      description: (e as Error).message,
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

// NOT `pending`: with `server: false`, Nuxt defers the initial fetch to
// `onBeforeMount`, so `pending` stays false through SSR render AND the gap
// before that callback fires -- the SSR'd HTML would flash empty content
// before ever showing a skeleton. `status` starts at "idle" both server-
// and client-side and only flips once a fetch has genuinely settled.
const { status: identityStatus } = useAsyncData(
  "profile-identity",
  async () => {
    try {
      await auth.fetchProfile();
      form.name = auth.session?.name ?? "";
      form.email = auth.session?.email ?? "";
      form.avatarUrl = auth.session?.avatarUrl ?? "";
    } catch (e) {
      toast.add({
        title: t("profile.toast.loadFailed"),
        description: (e as Error).message,
        color: "error",
      });
    }
    return null;
  },
  { server: false }
);
const identityLoading = computed(() => identityStatus.value !== "success" && identityStatus.value !== "error");

const { status: permissionsStatus } = useAsyncData(
  "profile-permissions",
  async () => {
    try {
      await perms.fetch();
    } catch {
      toast.add({ title: t("profile.permissions.loadFailed"), color: "error" });
    }
    return null;
  },
  { server: false }
);
const permissionsLoading = computed(() => permissionsStatus.value !== "success" && permissionsStatus.value !== "error");
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('profile.alertTitle')"
      :description="t('profile.alertDescription')"
    />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("profile.identity") }}</h2>
      </template>
      <div v-if="identityLoading" class="space-y-6">
        <div class="flex items-center gap-4">
          <USkeleton class="w-16 h-16 rounded-full shrink-0" />
          <div class="space-y-2">
            <USkeleton class="h-4 w-32" />
            <USkeleton class="h-5 w-24" />
          </div>
        </div>
        <USkeleton v-for="i in 3" :key="i" class="h-9 w-full" />
      </div>
      <UForm v-else :schema="schema" :state="form" class="space-y-6" @submit="save">
        <div class="flex items-center gap-4">
          <UAvatar :src="avatarPreview.src" :alt="avatarPreview.alt" size="3xl" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ auth.session?.username }}</p>
            <div class="flex flex-wrap gap-1">
              <UBadge v-if="auth.session?.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
                {{ t("layout.rootBadge") }}
              </UBadge>
              <template v-else-if="auth.session?.groups?.length">
                <UBadge
                  v-for="group in auth.session.groups"
                  :key="group.id"
                  color="primary"
                  variant="subtle"
                  icon="i-lucide-users-round"
                  class="max-w-48"
                >
                  <span class="truncate">{{ group.name }}</span>
                </UBadge>
              </template>
              <UBadge v-else color="neutral" variant="subtle" icon="i-lucide-user-x">
                {{ t("layout.noGroupBadge") }}
              </UBadge>
            </div>
          </div>
        </div>

        <UFormField :label="t('profile.displayName')" name="name" :description="t('profile.displayNameHint')">
          <UInput v-model="form.name" placeholder="Jane Doe" icon="i-lucide-user" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.email')" name="email" :description="t('profile.emailHint')">
          <UInput v-model="form.email" type="email" placeholder="jane@example.com" icon="i-lucide-mail" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.avatarUrl')" name="avatarUrl" :description="t('profile.avatarUrlHint')">
          <UInput v-model="form.avatarUrl" placeholder="https://..." icon="i-lucide-image" class="w-full" />
        </UFormField>

        <div class="flex justify-end">
          <UButton type="submit" :loading="loading" icon="i-lucide-save" color="primary">
            {{ t("profile.save") }}
          </UButton>
        </div>
      </UForm>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="font-semibold">{{ t("nav.groups") }}</h2>
          <UButton
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-shield-check"
            :disabled="auth.session?.isRoot ? false : permissionsLoading"
            @click="openEffectivePermissions"
          >
            {{ t("profile.permissions.title") }}
          </UButton>
        </div>
      </template>

      <div v-if="auth.session?.groups?.length" class="flex flex-wrap gap-1.5">
        <UBadge
          v-for="group in auth.session.groups"
          :key="group.id"
          as="button"
          type="button"
          color="primary"
          variant="subtle"
          icon="i-lucide-users-round"
          class="max-w-64 cursor-pointer hover:opacity-80"
          :title="t('profile.permissions.title')"
          @click="openGroupPermissions(group)"
        >
          <span class="truncate">{{ group.name }}</span>
        </UBadge>
      </div>

      <p v-else class="text-sm text-muted">{{ t("layout.noGroupBadge") }}</p>
    </UCard>

    <MyGroupPermissionsModal
      v-model:open="permModalOpen"
      :group-id="selectedGroup?.id ?? null"
      :group-name="selectedGroup?.name ?? ''"
    />

    <UModal v-model:open="effectiveModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 min-w-0">
              <UIcon name="i-lucide-shield-check" class="text-primary shrink-0" />
              <h3 class="font-semibold truncate">{{ t("profile.permissions.title") }}</h3>
            </div>
          </template>

          <div v-if="permissionsLoading" class="flex justify-center py-6">
            <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
          </div>

          <UBadge v-else-if="auth.session?.isRoot" color="primary" variant="subtle" icon="i-lucide-shield-check">
            {{ t("profile.permissions.root") }}
          </UBadge>

          <div v-else class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.globalTitle") }}</h4>
              <p v-if="groupedGlobalPermissions.length === 0" class="text-sm text-muted">
                {{ t("profile.permissions.empty") }}
              </p>
              <ul v-else class="space-y-2.5">
                <li v-for="g in groupedGlobalPermissions" :key="g.resource">
                  <p class="text-sm font-medium">{{ g.label }}</p>
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    <UBadge v-for="a in g.actions" :key="a" color="success" variant="subtle" size="md">{{ a }}</UBadge>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <h4 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.domainTitle") }}</h4>
              <p v-if="groupedDomainPermissions.length === 0" class="text-sm text-muted">
                {{ t("profile.permissions.empty") }}
              </p>
              <ul v-else class="space-y-2.5">
                <li v-for="g in groupedDomainPermissions" :key="`${g.domainId}:${g.resource}`">
                  <p class="text-sm font-medium">{{ g.domainName }} · {{ g.label }}</p>
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    <UBadge v-for="a in g.actions" :key="a" color="success" variant="subtle" size="md">{{ a }}</UBadge>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton color="neutral" variant="ghost" @click="closeEffectivePermissions">{{ t("common.cancel") }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
