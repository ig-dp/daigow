<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Buat Trip Baru" back-to="/seller/dashboard" back-label="Batal" class="mb-6" />

      <form class="items-start gap-4 grid lg:grid-cols-[minmax(0,1fr)_24rem]" @submit.prevent="submit">
        <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Dasar</h2>
          <div class="mt-5 space-y-4">
            <AppTextField v-model="form.title" id="title" name="title" label="Judul Trip *" placeholder="contoh: Japanese Travel 2026" autocomplete="off" :error="fieldErrors.title" />
            <div>
              <label class="field-label" for="destination">Negara <span class="text-red-600">*</span></label>
              <AppSelect id="destination" v-model="form.destination" :options="COUNTRY_OPTIONS" searchable placeholder="Pilih negara" search-placeholder="Cari negara..." :invalid="Boolean(fieldErrors.destination)" :aria-describedby="fieldErrors.destination ? 'destination-error' : undefined" />
              <p v-if="fieldErrors.destination" id="destination-error" class="field-error">{{ fieldErrors.destination }}</p>
            </div>
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

        <div class="space-y-4">
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 class="text-sm font-semibold">Cover Image</h2>
            <p class="mt-1 text-xs text-muted">Masukkan URL gambar cover. Satu gambar digunakan untuk desktop dan mobile.</p>
            <div class="mt-4">
              <AppTextField v-model="form.thumbnail_url" id="thumbnail" name="thumbnail_url" label="URL Cover *" type="url" placeholder="https://..." :error="fieldErrors.thumbnail_url" />
            </div>
            <img v-if="form.thumbnail_url" :src="form.thumbnail_url" alt="Preview cover" class="mt-4 rounded-lg w-full aspect-video object-cover" @error="imageError = true">
            <p v-if="imageError" class="field-error">URL gambar tidak dapat dimuat.</p>
          </section>
          <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
          <AppButton type="submit" :disabled="loading">{{ loading ? 'Membuat Trip...' : 'Buat Trip' }}</AppButton>
        </div>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import AppTextField from '../../../components/ui/AppTextField.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { COUNTRY_OPTIONS } from '#shared/utils/countries'

definePageMeta({ middleware: 'seller', layout: 'seller' })
useHead({ title: 'Buat Trip' })

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
