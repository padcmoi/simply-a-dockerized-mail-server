<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

definePageMeta({});

const loading = ref(false);
const permissionsLoading = ref(false);
const domainNames = ref<Record<number, string>>({});
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

const groupedGlobalPermissions = computed(() => {
  const byResource = new Map<string, string[]>();
  for (const p of perms.data.global) {
    byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p.action]);
  }
  return [...byResource.entries()].map(([resource, actions]) => ({ resource, actions: sortActions(actions) }));
});

const groupedDomainPermissions = computed(() => {
  const byKey = new Map<string, { domainId: number; resource: string; actions: string[] }>();
  for (const p of perms.data.domain) {
    const key = `${p.domainId}:${p.resource}`;
    const entry = byKey.get(key) ?? { domainId: p.domainId, resource: p.resource, actions: [] };
    entry.actions.push(p.action);
    byKey.set(key, entry);
  }
  return [...byKey.values()].map((entry) => ({ ...entry, actions: sortActions(entry.actions) }));
});

const { t } = useI18n();
const auth = useAuthStore();
const perms = usePermissionsStore();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.profile") }]);

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

onMounted(async () => {
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

  permissionsLoading.value = true;
  try {
    await perms.fetch();
    const domainIds = [...new Set(perms.data.domain.map((p) => p.domainId))];
    if (domainIds.length) {
      const domains = await call<{ id: number; domain: string }[]>("/domains");
      domainNames.value = Object.fromEntries(domains.map((d) => [d.id, d.domain]));
    }
  } catch {
    toast.add({ title: t("profile.permissions.loadFailed"), color: "error" });
  } finally {
    permissionsLoading.value = false;
  }
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
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
      <UForm :schema="schema" :state="form" class="space-y-6" @submit="save">
        <div class="flex items-center gap-4">
          <UAvatar :src="avatarPreview.src" :alt="avatarPreview.alt" size="3xl" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ auth.session?.username }}</p>
            <UBadge v-if="auth.session?.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
              {{ t("nav.rootBadge") }}
            </UBadge>
            <UBadge v-else-if="auth.session?.group" color="primary" variant="subtle" icon="i-lucide-users-round" class="max-w-48">
              <span class="truncate">{{ auth.session.group.name }}</span>
            </UBadge>
            <UBadge v-else color="neutral" variant="subtle" icon="i-lucide-user-x">
              {{ t("nav.noGroupBadge") }}
            </UBadge>
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
        <h2 class="font-semibold">{{ t("profile.permissions.title") }}</h2>
      </template>

      <div v-if="permissionsLoading" class="flex justify-center py-6">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>

      <UBadge v-else-if="auth.session?.isRoot" color="primary" variant="subtle" icon="i-lucide-shield-check">
        {{ t("profile.permissions.root") }}
      </UBadge>

      <div v-else class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.globalTitle") }}</h3>
          <p v-if="groupedGlobalPermissions.length === 0" class="text-sm text-muted">{{ t("profile.permissions.empty") }}</p>
          <div v-else class="flex flex-wrap gap-1.5">
            <UBadge v-for="g in groupedGlobalPermissions" :key="g.resource" color="neutral" variant="subtle" size="sm">
              {{ g.resource }}: {{ g.actions.join(", ") }}
            </UBadge>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-medium text-muted mb-2">{{ t("profile.permissions.domainTitle") }}</h3>
          <p v-if="groupedDomainPermissions.length === 0" class="text-sm text-muted">{{ t("profile.permissions.empty") }}</p>
          <div v-else class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="g in groupedDomainPermissions"
              :key="`${g.domainId}:${g.resource}`"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ domainNames[g.domainId] ?? `#${g.domainId}` }} · {{ g.resource }}: {{ g.actions.join(", ") }}
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
