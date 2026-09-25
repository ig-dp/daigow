<template>
  <AuthShell subtitle="Masuk sebagai Seller">
    <form class="space-y-4" @submit.prevent="submit">
      <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
      <AppTextField
        id="email"
        v-model="email"
        name="email"
        type="email"
        label="Email"
        placeholder="seller@email.com"
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
      Belum punya akun? <a href="#" class="link-brand">Daftar sebagai Seller</a>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppTextField from '~/components/ui/AppTextField.vue'
import AppButton from '~/components/ui/AppButton.vue'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Masuk Seller | Daigow' })

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

  loading.value = false
  if (error) {
    errorMessage.value = 'Email atau password salah.'
    return
  }

  await navigateTo('/seller/dashboard')
}
</script>
