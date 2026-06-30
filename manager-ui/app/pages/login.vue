<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const loading = ref(false);
const state = reactive({ username: "", password: "" });

const auth = useAuthStore();
const toast = useToast();
const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

async function onSubmit() {
  loading.value = true;
  try {
    await auth.login(state.username, state.password);
    await navigateTo("/domains");
  } catch (err) {
    toast.add({ title: "Login failed", description: (err as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-mail" class="text-primary text-2xl" />
        <h1 class="text-lg font-semibold">Mail Manager</h1>
      </div>
      <p class="text-sm text-muted mt-1">Sign in to manage domains, recipients and aliases.</p>
    </template>
    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Username" name="username" required>
        <UInput v-model="state.username" autocomplete="username" icon="i-lucide-user" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" icon="i-lucide-lock" class="w-full" />
      </UFormField>
      <UButton type="submit" :loading="loading" block size="lg">Sign in</UButton>
    </UForm>
  </UCard>
</template>
