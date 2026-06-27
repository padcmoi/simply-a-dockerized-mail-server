<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const toast = useToast()
const loading = ref(false)
const state = reactive({ username: '', password: '' })
const schema = z.object({
  username: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})

async function onSubmit() {
  loading.value = true
  try {
    await auth.login(state.username, state.password)
    await navigateTo('/domains')
  } catch (err) {
    toast.add({ title: 'Login failed', description: (err as Error).message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <div class="text-xl font-semibold">Mail Manager</div>
      <div class="text-sm text-neutral-500">Sign in to continue</div>
    </template>
    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Username" name="username" required>
        <UInput v-model="state.username" autocomplete="username" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UButton type="submit" :loading="loading" block>Sign in</UButton>
    </UForm>
  </UCard>
</template>
