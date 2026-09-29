<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Jadi Seller</h1>
      <section class="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 class="border-b border-border pb-4 text-sm font-semibold">Kode Undangan</h2>
        <form class="mt-5 space-y-4" @submit.prevent="submit">
          <AppTextField id="invite-code" v-model="code" name="code" label="Kode Jastiper *" placeholder="Masukkan kode undangan" autocomplete="off" :error="codeError" />
          <AppButton type="submit" :disabled="loading">{{ loading ? 'Memproses...' : 'Jadi Seller' }}</AppButton>
        </form>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import AppTextField from '~/components/ui/AppTextField.vue'

definePageMeta({ middleware: 'auth', layout: 'account' })
useHead({ title: 'Jadi Seller' })

const code = ref('')
const codeError = ref('')
const loading = ref(false)
const CODE_ERRORS: Record<string, string> = {
  INVALID_INVITE_CODE: 'Kode undangan salah.',
  RATE_LIMITED: 'Terlalu banyak percobaan, coba lagi nanti.'
}

async function submit() {
  codeError.value = ''
  if (!code.value.trim()) {
    codeError.value = 'Masukkan kode undangan.'
    return
  }
  loading.value = true
  try {
    await $fetch('/api/me/become-jastiper', { method: 'POST', body: { code: code.value.trim() } })
  } catch (e: any) {
    // INVALID_STATE means already a seller: fall through to the dashboard.
    const errorCode = e?.data?.error?.code
    if (errorCode !== 'INVALID_STATE') {
      codeError.value = CODE_ERRORS[errorCode] ?? 'Gagal memproses kode, coba lagi.'
      loading.value = false
      return
    }
  }
  // Role changed: drop the cached role so the seller middleware refetches it.
  clearNuxtState('admin-role')
  await navigateTo('/seller/dashboard')
}
</script>
