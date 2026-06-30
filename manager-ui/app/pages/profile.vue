<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

const auth = useAuthStore();
const toast = useToast();
const loading = ref(false);

const form = reactive({
  name: auth.session?.name ?? "",
  email: auth.session?.email ?? "",
  avatarUrl: auth.session?.avatarUrl ?? "",
});

onMounted(async () => {
  try {
    await auth.fetchProfile();
    form.name = auth.session?.name ?? "";
    form.email = auth.session?.email ?? "";
    form.avatarUrl = auth.session?.avatarUrl ?? "";
  } catch (e) {
    toast.add({ title: "Failed to load profile", description: (e as Error).message, color: "error" });
  }
});

const schema = z.object({
  name: z.string().max(255).optional(),
  email: z.string().email("Invalid email").max(255).or(z.literal("")).optional(),
  avatarUrl: z.string().url("Must be a URL").max(1024).or(z.literal("")).optional(),
});

async function save() {
  loading.value = true;
  try {
    await auth.updateProfile({
      name: form.name.trim() || null,
      email: form.email.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
    });
    toast.add({ title: "Profile updated", color: "success" });
  } catch (e) {
    toast.add({ title: "Update failed", description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

const avatarPreview = computed(() => {
  if (form.avatarUrl.trim()) return { src: form.avatarUrl.trim(), alt: form.name || auth.session?.username || "?" };
  return { alt: form.name || auth.session?.username || "?" };
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Your account profile"
      description="Used for the sidebar avatar and future notifications. Authentication still uses your username."
    />

    <UCard>
      <template #header>
        <h2 class="font-semibold">Identity</h2>
      </template>
      <UForm :schema="schema" :state="form" class="space-y-6" @submit="save">
        <div class="flex items-center gap-4">
          <UAvatar :src="avatarPreview.src" :alt="avatarPreview.alt" size="3xl" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ auth.session?.username }}</p>
            <UBadge v-if="auth.session?.isRoot" color="primary" variant="subtle" icon="i-lucide-shield"> root </UBadge>
          </div>
        </div>

        <UFormField label="Display name" name="name" description="Shown in the sidebar instead of your username.">
          <UInput v-model="form.name" placeholder="Jane Doe" icon="i-lucide-user" class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email" description="Optional; must be unique across accounts.">
          <UInput v-model="form.email" type="email" placeholder="jane@example.com" icon="i-lucide-mail" class="w-full" />
        </UFormField>

        <UFormField
          label="Avatar URL"
          name="avatarUrl"
          description="Public HTTPS URL to a square image; falls back to initials if empty."
        >
          <UInput v-model="form.avatarUrl" placeholder="https://..." icon="i-lucide-image" class="w-full" />
        </UFormField>

        <div class="flex justify-end">
          <UButton type="submit" :loading="loading" icon="i-lucide-save" color="primary">Save changes</UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
