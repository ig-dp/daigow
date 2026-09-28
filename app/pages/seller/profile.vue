<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Profil Saya" back-to="/seller/dashboard" back-label="Kembali" class="mb-6" />
      <section class="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 class="border-b border-border pb-4 text-sm font-semibold">Data Diri</h2>
        <form class="mt-5 space-y-4" @submit.prevent="save">
          <AppTextField v-model="form.name" id="name" name="name" label="Nama Lengkap *" autocomplete="name" :error="fieldErrors.name" />
          <AppTextField v-model="form.phone" id="phone" name="phone" label="Nomor Telepon" type="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" />
          <p v-if="message" class="text-sm" :class="saved ? 'text-brand' : 'text-red-700'" role="status">{{ message }}</p>
          <AppButton type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan Profil' }}</AppButton>
        </form>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import AppTextField from '~/components/ui/AppTextField.vue'

definePageMeta({ middleware: 'seller', layout: 'seller' })
useHead({ title: 'Profil' })

const form = reactive({ name: '', phone: '' })
const fieldErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const saved = ref(false)
const message = ref('')

const { data } = await useFetch('/api/me')
if (data.value?.profile) {
  form.name = data.value.profile.name ?? ''
  form.phone = data.value.profile.phone ?? ''
}

async function save() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  message.value = ''
  saved.value = false
  if (!form.name.trim()) fieldErrors.name = 'Nama wajib diisi.'
  if (Object.keys(fieldErrors).length) return
  saving.value = true
  try {
    await $fetch('/api/me', { method: 'PATCH', body: { name: form.name, phone: form.phone || null } })
    saved.value = true
    message.value = 'Profil berhasil disimpan.'
  } catch {
    message.value = 'Profil gagal disimpan. Coba lagi.'
  } finally { saving.value = false }
}
</script>
