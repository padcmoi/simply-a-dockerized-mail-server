<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({});

const loading = ref(false);
const form = reactive({ name: "", email: "", avatarUrl: "" });

const avatarPreview = computed(() => {
  if (form.avatarUrl.trim()) return { src: form.avatarUrl.trim(), alt: form.name || auth.session?.username || "?" };
  return { alt: form.name || auth.session?.username || "?" };
});

const { t } = useI18n();
const auth = useAuthStore();
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
    toast.add({ title: t("profile.toast.updateFailed"), description: (e as Error).message, color: "error" });
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
    toast.add({ title: t("profile.toast.loadFailed"), description: (e as Error).message, color: "error" });
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
            <UBadge v-if="auth.session?.isRoot" color="primary" variant="subtle" icon="i-lucide-shield"> root </UBadge>
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
  </div>
</template>
