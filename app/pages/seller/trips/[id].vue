<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Edit Trip" back-to="/seller/dashboard" class="mb-6" />
      <div v-if="pending" class="text-sm text-muted">Memuat trip...</div>
      <p v-else-if="loadError" class="field-error">Trip gagal dimuat.</p>
      <template v-else>
        <form class="items-start gap-4 grid lg:grid-cols-[minmax(0,1fr)_24rem]" @submit.prevent="submit">
          <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Dasar</h2>
            <div class="mt-5 space-y-4">
              <AppTextField v-model="form.title" id="title" name="title" label="Judul Trip *" :error="fieldErrors.title" />
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
                <textarea id="description" v-model="form.description" class="field-input min-h-24 resize-y" />
              </div>
            </div>
          </section>
          <div class="space-y-4">
            <section class="rounded-xl border border-border bg-white p-6 shadow-sm" aria-labelledby="trip-share-title">
              <h2 id="trip-share-title" class="text-sm font-semibold">Link Trip Publik</h2>
              <div class="flex gap-2 mt-4">
                <input ref="shareInput" class="flex-1 min-w-0 seller-form-input" type="text" :value="publicUrl" readonly aria-label="Link publik Trip" @focus="selectPublicUrl">
                <button type="button" aria-label="Salin link" title="Salin link" class="inline-flex justify-center items-center hover:bg-brand/5 border border-brand rounded-md size-12 text-brand shrink-0 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2" @click="copyPublicUrl">
                  <Icon name="material-symbols:content-copy-outline-rounded" class="text-xl" aria-hidden="true" />
                </button>
                <NuxtLink :to="publicPath" target="_blank" rel="noopener noreferrer" aria-label="Buka halaman publik" title="Buka halaman publik" class="inline-flex justify-center items-center bg-brand hover:bg-brand-hover rounded-md size-12 text-white shrink-0 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2">
                  <Icon name="material-symbols:open-in-new-rounded" class="text-xl" aria-hidden="true" />
                </NuxtLink>
              </div>
              <p v-if="shareMessage" role="status" class="mt-2 text-muted text-sm">{{ shareMessage }}</p>
            </section>
            <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 class="text-sm font-semibold">Status Trip</h2>
              <div class="flex flex-col gap-2 mt-4">
                <AppSelect v-model="selectedStatus" :options="statusOptions" class="w-full" :disabled="statusSaving || trip?.status === 'closed'" />
                <button v-if="selectedStatus !== trip?.status && trip?.status !== 'closed'" class="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50" type="button" :disabled="statusSaving" @click.prevent="saveStatus">
                  {{ statusSaving ? 'Menyimpan...' : 'Simpan Status' }}
                </button>
              </div>
              <p v-if="statusMessage" class="mt-2 text-xs text-muted">{{ statusMessage }}</p>
            </section>
            <section class="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 class="text-sm font-semibold">Cover Image</h2>
              <div class="mt-4"><AppTextField v-model="form.thumbnail_url" id="thumbnail" name="thumbnail_url" label="URL Cover *" type="url" :error="fieldErrors.thumbnail_url" /></div>
              <img v-if="form.thumbnail_url" :src="form.thumbnail_url" alt="Preview cover" class="mt-4 rounded-lg w-full aspect-video object-cover">
            </section>
            <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
            <AppButton type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}</AppButton>
          </div>
        </form>
      </template>
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

const route = useRoute()
const requestUrl = useRequestURL()
const tripId = String(route.params.id)
const { data, pending, error: loadError } = await useFetch(`/api/seller/trips/${tripId}`)
const trip = computed(() => data.value?.trip)
useHead({ title: () => trip.value ? `Edit ${trip.value.title}` : 'Edit Trip' })
const form = reactive({ title: '', destination: '', description: '', thumbnail_url: '', order_open_at: '', order_close_at: '' })
const fieldErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const statusSaving = ref(false)
const statusMessage = ref('')
const selectedStatus = ref('')
// Only forward transitions are allowed: coming_soon → open → closed.
const statusOptions = computed(() => {
  const status = trip.value?.status
  if (!status) return []
  const next = status === 'coming_soon' ? ['open'] : status === 'open' ? ['closed'] : []
  return [status, ...next].map(value => ({ value, label: formatTripStatus(value), dot: tripStatusDotClass(value) }))
})
const errorMessage = ref('')
const shareInput = ref<HTMLInputElement | null>(null)
const shareMessage = ref('')
const publicPath = computed(() => `/t/${trip.value?.slug ?? ''}`)
const publicUrl = computed(() => new URL(publicPath.value, requestUrl.origin).href)

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
  // Older trips stored free-text destinations; make the seller pick a country before saving.
  form.destination = isCountryCode(value.destination) ? value.destination : ''
  form.description = value.description ?? ''
  form.thumbnail_url = value.thumbnail_url
  form.order_open_at = value.order_open_at.slice(0, 10)
  form.order_close_at = value.order_close_at.slice(0, 10)
  selectedStatus.value = value.status
}, { immediate: true })

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
