<template>
  <section class="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
    <h2 class="border-b border-border pb-4 text-sm font-semibold">Data Diri</h2>
    <form class="mt-5 space-y-4" @submit.prevent="save">
      <AppTextField v-model="form.name" id="name" name="name" label="Nama Lengkap *" autocomplete="name" :error="fieldErrors.name" />
      <AppTextField v-model="form.phone" id="phone" name="phone" label="Nomor Telepon" type="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" />
      <div>
        <label class="field-label" for="address">Alamat Pengiriman</label>
        <textarea id="address" v-model="form.address" name="address" autocomplete="street-address" class="field-input min-h-24 resize-y" placeholder="Jalan, nomor rumah, kota, kode pos" />
      </div>
      <p v-if="message" class="text-sm" :class="saved ? 'text-brand' : 'text-red-700'" role="status">{{ message }}</p>
      <AppButton type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan Profil' }}</AppButton>
    </form>
  </section>
</template>

<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import AppTextField from '~/components/ui/AppTextField.vue'

const form = reactive({ name: '', phone: '', address: '' })
const fieldErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const saved = ref(false)
const message = ref('')

const { data } = await useFetch('/api/me', { key: 'me' })
if (data.value?.profile) {
  form.name = data.value.profile.name ?? ''
  form.phone = data.value.profile.phone ?? ''
  form.address = data.value.profile.address ?? ''
}

async function save() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  message.value = ''
  saved.value = false
  if (!form.name.trim()) fieldErrors.name = 'Nama wajib diisi.'
  if (Object.keys(fieldErrors).length) return
  saving.value = true
  try {
    data.value = await $fetch('/api/me', { method: 'PATCH', body: { name: form.name, phone: form.phone || null, address: form.address.trim() || null } })
    saved.value = true
    message.value = 'Profil berhasil disimpan.'
  } catch {
    message.value = 'Profil gagal disimpan. Coba lagi.'
  } finally { saving.value = false }
}
</script>
