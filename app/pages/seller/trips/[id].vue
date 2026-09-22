<template>
  <main class="seller-page">
    <section class="mx-auto max-w-3xl">
      <button class="mb-5 text-sm text-muted hover:text-brand" type="button" @click="navigateTo('/seller/dashboard')">← Kembali</button>
      <div v-if="pending" class="text-sm text-muted">Memuat trip...</div>
      <p v-else-if="loadError" class="field-error">Trip gagal dimuat.</p>
      <template v-else>
        <h1 class="mb-6 text-2xl font-bold text-ink">Edit Trip</h1>
        <form class="space-y-4" @submit.prevent="submit">
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Dasar</h2>
            <div class="mt-5 space-y-4">
              <AppTextField v-model="form.title" id="title" name="title" label="Judul Trip *" :error="fieldErrors.title" />
              <AppTextField v-model="form.destination" id="destination" name="destination" label="Destinasi" :error="fieldErrors.destination" />
              <div class="grid gap-4 sm:grid-cols-2">
                <AppTextField v-model="form.order_open_at" id="order-open" name="order_open_at" label="Tanggal Mulai *" type="date" :error="fieldErrors.order_open_at" />
                <AppTextField v-model="form.order_close_at" id="order-close" name="order_close_at" label="Tanggal Selesai *" type="date" :error="fieldErrors.order_close_at" />
              </div>
              <div>
                <label class="field-label" for="description">Teks Coming Soon</label>
                <textarea id="description" v-model="form.description" class="field-input min-h-24 resize-y" />
              </div>
            </div>
          </section>
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 class="text-sm font-semibold">Status Trip</h2>
            <div class="mt-4 flex gap-3">
              <select v-model="selectedStatus" class="field-input max-w-xs" :disabled="statusSaving || trip?.status === 'closed'">
                <option :value="trip?.status">{{ statusLabel(trip?.status) }}</option>
                <option v-if="trip?.status === 'coming_soon'" value="open">Open</option>
                <option v-if="trip?.status === 'open'" value="closed">Closed</option>
              </select>
              <button v-if="selectedStatus !== trip?.status && trip?.status !== 'closed'" class="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50" type="button" :disabled="statusSaving" @click.prevent="saveStatus">
                {{ statusSaving ? 'Menyimpan...' : 'Simpan Status' }}
              </button>
            </div>
            <p v-if="statusMessage" class="mt-2 text-xs text-muted">{{ statusMessage }}</p>
          </section>
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm" aria-labelledby="trip-share-title">
            <h2 id="trip-share-title" class="text-lg font-semibold">Link Trip Publik</h2>
            <p class="mt-1 text-sm text-muted">Bagikan link ini kepada pembeli. Saat Coming Soon mereka dapat berlangganan; saat Trip dibuka mereka dapat melihat katalog.</p>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row">
              <input ref="shareInput" class="seller-form-input min-w-0 flex-1" type="text" :value="publicUrl" readonly aria-label="Link publik Trip" @focus="selectPublicUrl">
              <button type="button" class="min-h-12 shrink-0 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand" @click="copyPublicUrl">Salin Link</button>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <NuxtLink :to="publicPath" target="_blank" rel="noopener noreferrer" class="font-medium text-brand underline focus-visible:outline-2 focus-visible:outline-brand">Buka halaman publik ↗</NuxtLink>
              <span v-if="shareMessage" role="status" class="text-muted">{{ shareMessage }}</span>
            </div>
            <p v-if="isLocalUrl" class="mt-3 text-sm text-muted">Link localhost hanya dapat dibuka di komputer ini. Bagikan link dari domain website setelah dipublikasikan.</p>
          </section>
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 class="text-sm font-semibold">Cover Image</h2>
            <div class="mt-4"><AppTextField v-model="form.thumbnail_url" id="thumbnail" name="thumbnail_url" label="URL Cover *" type="url" :error="fieldErrors.thumbnail_url" /></div>
            <img v-if="form.thumbnail_url" :src="form.thumbnail_url" alt="Preview cover" class="mt-4 h-40 w-full rounded-lg object-cover">
          </section>
          <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
          <AppButton type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}</AppButton>
        </form>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppTextField from '../../../components/ui/AppTextField.vue'
import AppButton from '../../../components/ui/AppButton.vue'

definePageMeta({ middleware: 'seller', layout: 'seller' })

const route = useRoute()
const requestUrl = useRequestURL()
const tripId = String(route.params.id)
const { data, pending, error: loadError } = await useFetch(`/api/seller/trips/${tripId}`)
const trip = computed(() => data.value?.trip)
const form = reactive({ title: '', destination: '', description: '', thumbnail_url: '', order_open_at: '', order_close_at: '' })
const fieldErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const statusSaving = ref(false)
const statusMessage = ref('')
const selectedStatus = ref('')
const errorMessage = ref('')
const shareInput = ref<HTMLInputElement | null>(null)
const shareMessage = ref('')
const publicPath = computed(() => `/t/${trip.value?.slug ?? ''}`)
const publicUrl = computed(() => new URL(publicPath.value, requestUrl.origin).href)
const isLocalUrl = ['localhost', '127.0.0.1'].includes(requestUrl.hostname)

function selectPublicUrl() {
  shareInput.value?.select()
}

async function copyPublicUrl() {
  shareMessage.value = ''
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    shareMessage.value = 'Link berhasil disalin.'
  } catch {
    shareInput.value?.focus()
    shareInput.value?.select()
    shareMessage.value = 'Salin link yang sudah dipilih.'
  }
}

watch(trip, (value) => {
  if (!value) return
  form.title = value.title
  form.destination = value.destination
  form.description = value.description ?? ''
  form.thumbnail_url = value.thumbnail_url
  form.order_open_at = value.order_open_at.slice(0, 10)
  form.order_close_at = value.order_close_at.slice(0, 10)
  selectedStatus.value = value.status
}, { immediate: true })

function statusLabel(status?: string) {
  return status === 'open' ? 'Open' : status === 'closed' ? 'Closed' : 'Coming Soon'
}

async function saveStatus() {
  if (!trip.value) return
  statusMessage.value = ''
  statusSaving.value = true
  try {
    const url = `/api/seller/trips/${tripId}/${selectedStatus.value}`
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    if (!response.ok) throw new Error('status update failed')
    await refreshNuxtData()
    statusMessage.value = 'Status berhasil diperbarui.'
  } catch {
    statusMessage.value = 'Gagal mengubah status.'
    selectedStatus.value = trip.value.status
  } finally {
    statusSaving.value = false
  }
}

async function submit() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  errorMessage.value = ''
  for (const key of ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at']) {
    if (!form[key as keyof typeof form]) fieldErrors[key] = 'Field ini wajib diisi.'
  }
  if (form.order_close_at < form.order_open_at) fieldErrors.order_close_at = 'Tanggal selesai harus setelah tanggal mulai.'
  if (Object.keys(fieldErrors).length) return

  saving.value = true
  try {
    await $fetch(`/api/seller/trips/${tripId}`, {
      method: 'PATCH',
      body: {
        ...form,
        order_open_at: new Date(`${form.order_open_at}T00:00:00`).toISOString(),
        order_close_at: new Date(`${form.order_close_at}T23:59:59`).toISOString()
      }
    })
    await navigateTo('/seller/dashboard')
  } catch {
    errorMessage.value = 'Perubahan gagal disimpan.'
  } finally {
    saving.value = false
  }
}
</script>
