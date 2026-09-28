<template>
  <AuthShell subtitle="Masuk sebagai Admin">
    <form class="space-y-4" @submit.prevent="submit">
      <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
      <AppTextField
        id="email"
        v-model="email"
        name="email"
        type="email"
        label="Email"
        placeholder="admin@email.com"
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
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import AppTextField from '~/components/ui/AppTextField.vue'
import AppButton from '~/components/ui/AppButton.vue'

// Signed-in admins skip the form; a signed-in non-admin sees the form with a notice.
definePageMeta({
  middleware: async () => {
    if (useSupabaseUser().value && await useAdminRole().load() === 'admin') return navigateTo('/admin/orders')
  }
})
useHead({ title: 'Masuk Admin | Daigow', meta: [{ name: 'robots', content: 'noindex' }] })

const email = ref('')
const password = ref('')
const loading = ref(false)
const supabase = useSupabaseClient()
const errorMessage = ref(useSupabaseUser().value ? 'Akun ini bukan admin.' : '')

async function submit() {
  errorMessage.value = ''
  loading.value = true
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  if (error) {
    loading.value = false
    errorMessage.value = 'Email atau password salah.'
    return
  }

  // Straight to the API: useSupabaseUser may not reflect the new session yet.
  const role = await $fetch<{ profile: { role: string } }>('/api/me').then(res => res.profile.role).catch(() => null)
  if (role !== 'admin') {
    await supabase.auth.signOut()
    loading.value = false
    errorMessage.value = 'Akun ini bukan admin.'
    return
  }
  await navigateTo('/admin/orders')
}
</script>
