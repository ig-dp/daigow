<template>
  <AuthShell subtitle="Daftar">
    <p v-if="notice" class="text-sm text-ink" role="status">{{ notice }}</p>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <p v-if="errorMessage" class="field-error" role="alert">{{ errorMessage }}</p>
      <AppTextField
        id="name"
        v-model="name"
        name="name"
        label="Nama"
        placeholder="Nama lengkap"
        autocomplete="name"
      />
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
        placeholder="Minimal 6 karakter"
        autocomplete="new-password"
      />
      <AppButton type="submit" :disabled="loading">{{ loading ? 'Memproses...' : 'Daftar' }}</AppButton>
    </form>

    <template #footer>
      Sudah punya akun? <NuxtLink to="/login" class="link-brand">Masuk</NuxtLink>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppTextField from '~/components/ui/AppTextField.vue'
import AppButton from '~/components/ui/AppButton.vue'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Daftar | Daigow' })

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const notice = ref('')
const supabase = useSupabaseClient()

async function submit() {
  errorMessage.value = ''
  if (!name.value.trim() || !email.value.trim()) {
    errorMessage.value = 'Nama dan email wajib diisi.'
    return
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Password minimal 6 karakter.'
    return
  }

  loading.value = true
  const { data, error } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: { data: { name: name.value.trim() } }
  })
  loading.value = false

  if (error) {
    errorMessage.value = error.code === 'user_already_exists' ? 'Email sudah terdaftar.' : 'Pendaftaran gagal, coba lagi.'
    return
  }
  // Email confirmation on: no session until the user clicks the link.
  if (!data.session) {
    notice.value = 'Cek email kamu untuk verifikasi, lalu masuk.'
    return
  }

  await navigateTo('/account')
}
</script>
