<template>
  <main class="seller-page">
    <section class="mx-auto max-w-3xl">
      <button class="mb-5 text-sm text-muted hover:text-brand" type="button" @click="navigateTo('/seller/dashboard')">← Batal</button>
      <h1 class="mb-6 text-2xl font-bold text-ink">Buat Trip Baru</h1>

      <form class="space-y-4" @submit.prevent="submit">
        <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Dasar</h2>
          <div class="mt-5 space-y-4">
            <AppTextField v-model="form.title" id="title" name="title" label="Judul Trip *" placeholder="contoh: Japanese Travel 2026" autocomplete="off" :error="fieldErrors.title" />
            <AppTextField v-model="form.destination" id="destination" name="destination" label="Destinasi" placeholder="contoh: Tokyo, Osaka, Kyoto" autocomplete="off" :error="fieldErrors.destination" />
            <div class="grid gap-4 sm:grid-cols-2">
              <AppTextField v-model="form.order_open_at" id="order-open" name="order_open_at" label="Tanggal Mulai *" type="date" :error="fieldErrors.order_open_at" />
              <AppTextField v-model="form.order_close_at" id="order-close" name="order_close_at" label="Tanggal Selesai *" type="date" :error="fieldErrors.order_close_at" />
            </div>
            <div>
              <label class="field-label" for="description">Teks Coming Soon</label>
              <textarea id="description" v-model="form.description" class="field-input min-h-24 resize-y" placeholder="Pesan yang ditampilkan sebelum trip dibuka..." />
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 class="text-sm font-semibold">Cover Image</h2>
          <p class="mt-1 text-xs text-muted">Masukkan URL gambar cover. Satu gambar digunakan untuk desktop dan mobile.</p>
          <div class="mt-4">
            <AppTextField v-model="form.thumbnail_url" id="thumbnail" name="thumbnail_url" label="URL Cover *" type="url" placeholder="https://..." :error="fieldErrors.thumbnail_url" />
          </div>
          <img v-if="form.thumbnail_url" :src="form.thumbnail_url" alt="Preview cover" class="mt-4 h-40 w-full rounded-lg object-cover" @error="imageError = true">
          <p v-if="imageError" class="field-error">URL gambar tidak dapat dimuat.</p>
        </section>

        <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
        <AppButton type="submit" :disabled="loading">{{ loading ? 'Membuat Trip...' : 'Buat Trip' }}</AppButton>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppTextField from '../../../components/ui/AppTextField.vue'
import AppButton from '../../../components/ui/AppButton.vue'

definePageMeta({ middleware: 'seller', layout: 'seller' })

const form = reactive({ title: '', destination: '', description: '', thumbnail_url: '', order_open_at: '', order_close_at: '' })
const fieldErrors = reactive<Record<string, string>>({})
const loading = ref(false)
const errorMessage = ref('')
const imageError = ref(false)

async function submit() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  errorMessage.value = ''
  imageError.value = false

  for (const key of ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at']) {
    if (!form[key as keyof typeof form]) fieldErrors[key] = 'Field ini wajib diisi.'
  }
  if (form.order_open_at && form.order_close_at && form.order_close_at < form.order_open_at) {
    fieldErrors.order_close_at = 'Tanggal selesai harus setelah tanggal mulai.'
  }
  if (Object.keys(fieldErrors).length) return

  loading.value = true
  try {
    await $fetch('/api/seller/trips', {
      method: 'POST',
      body: {
        ...form,
        order_open_at: new Date(`${form.order_open_at}T00:00:00`).toISOString(),
        order_close_at: new Date(`${form.order_close_at}T23:59:59`).toISOString()
      }
    })
    await navigateTo('/seller/dashboard')
  } catch {
    errorMessage.value = 'Trip gagal dibuat. Periksa data lalu coba lagi.'
  } finally {
    loading.value = false
  }
}
</script>
