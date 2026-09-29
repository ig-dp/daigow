<template>
  <AuthShell subtitle="Masuk">
    <form class="space-y-4" @submit.prevent="submit">
      <p v-if="errorMessage" class="field-error" role="alert">{{ errorMessage }}</p>
      <AppTextField
        id="email"
        v-model="email"
        name="email"
        type="email"
        label="Email"
        placeholder="nama@email.com"
        autocomplete="email"
      />
      <AppTextField
        id="password"
        v-model="password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autocomplete="current-password"
      />
      <AppButton type="submit" :disabled="loading">{{ loading ? 'Memproses...' : 'Masuk' }}</AppButton>
    </form>

    <template #footer>
      Belum punya akun? <NuxtLink to="/register" class="link-brand">Daftar</NuxtLink>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppTextField from '~/components/ui/AppTextField.vue'
import AppButton from '~/components/ui/AppButton.vue'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Masuk | Daigow' })

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const supabase = useSupabaseClient()

async function submit() {
  errorMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  if (error) {
    loading.value = false
    errorMessage.value = 'Email atau password salah.'
    return
  }

  // Straight to the API: useSupabaseUser may not reflect the new session yet.
  const role = await $fetch<{ profile: { role: string } }>('/api/me').then(res => res.profile.role).catch(() => null)
  await navigateTo(role === 'jastiper' || role === 'admin' ? '/seller/dashboard' : '/account')
}
</script>
