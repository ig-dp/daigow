<template>
  <section class="seller-page">
    <div class="seller-product-form">
      <NuxtLink to="/seller/products" class="inline-flex items-center gap-2 text-sm text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span aria-hidden="true">←</span> Batal
      </NuxtLink>
      <h1 class="mt-5 text-[1.875rem] font-semibold leading-tight tracking-tight">Tambah Produk Baru</h1>

      <form class="mt-6 space-y-5" @submit.prevent="submit">
        <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="photos-title">
          <h2 id="photos-title" class="text-lg font-semibold">Foto Produk</h2>
          <p class="mt-1 text-sm text-muted">Tambahkan minimal satu foto. Maksimal 5 foto.</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <div v-for="(photo, index) in photos" :key="photo.preview" class="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-canvas">
              <img :src="photo.preview" :alt="`Foto produk ${index + 1}`" class="h-full w-full object-cover">
              <button type="button" class="absolute right-1 top-1 rounded bg-white/95 px-1.5 py-0.5 text-xs text-ink shadow hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand" :aria-label="`Hapus foto ${index + 1}`" @click="removePhoto(index)">×</button>
            </div>
            <label v-if="photos.length < 5" class="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white text-sm text-muted hover:border-brand hover:text-brand focus-within:outline-2 focus-within:outline-brand">
              <span aria-hidden="true" class="text-2xl leading-none">+</span>
              <span class="mt-1">Tambah</span>
              <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="addPhotos">
            </label>
          </div>
          <p v-if="errors.photos" class="mt-2 text-sm text-red-700" role="alert">{{ errors.photos }}</p>
        </section>

        <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="detail-title">
          <h2 id="detail-title" class="border-b border-border pb-3 text-lg font-semibold">Detail Produk</h2>
          <div class="mt-5 space-y-5">
            <div>
              <label class="seller-form-label" for="product-trip">Trip *</label>
              <select id="product-trip" v-model="tripId" class="seller-form-input" :aria-invalid="Boolean(errors.trip)" :aria-describedby="errors.trip ? 'trip-error' : undefined">
                <option value="">Pilih trip</option>
                <option v-for="trip in trips?.trips ?? []" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
              </select>
              <p v-if="errors.trip" id="trip-error" class="mt-1 text-sm text-red-700">{{ errors.trip }}</p>
              <p v-if="tripsError" class="mt-2 text-sm text-red-700" role="alert">Trip gagal dimuat. <button type="button" class="font-semibold underline" @click="refreshTrips()">Coba lagi</button></p>
              <p v-else-if="trips && !trips.trips.length" class="mt-2 text-sm text-muted">Belum ada trip. <NuxtLink to="/seller/trips/new" class="font-medium text-brand underline">Buat trip dulu</NuxtLink>.</p>
            </div>
            <div>
              <label class="seller-form-label" for="product-name">Nama Produk *</label>
              <input id="product-name" v-model="name" class="seller-form-input" type="text" autocomplete="off" placeholder="Contoh: Sony WH-1000XM5" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'name-error' : undefined">
              <p v-if="errors.name" id="name-error" class="mt-1 text-sm text-red-700">{{ errors.name }}</p>
            </div>
            <div>
              <label class="seller-form-label" for="product-category">Kategori</label>
              <input id="product-category" v-model="category" class="seller-form-input" type="text" placeholder="Contoh: Elektronik">
            </div>
            <div>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label class="seller-form-label mb-0" for="product-description">Deskripsi</label>
                <button type="button" class="rounded-md border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50" :disabled="generating || saving || !name.trim() || !photos.length" @click="generateDescription">
                  {{ generating ? 'Membuat draft...' : '✧ Draft dengan AI' }}
                </button>
              </div>
              <textarea id="product-description" v-model="description" class="seller-form-input min-h-28 resize-y" placeholder="Deskripsi produk..." />
              <p v-if="aiError" class="mt-1 text-sm text-red-700" role="alert">{{ aiError }}</p>
              <p class="mt-1 text-xs text-muted">Draft AI dapat diedit sebelum produk disimpan.</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="price-title">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="price-title" class="text-lg font-semibold">Varian &amp; Harga</h2>
            <button type="button" class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand" @click="addVariant">+ Tambah Varian</button>
          </div>

          <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Pilih harga atau varian">
            <button type="button" :aria-pressed="activeTab === 'base'" class="rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand" :class="activeTab === 'base' ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-border'" @click="activeTab = 'base'">Dasar</button>
            <button v-for="(variant, index) in variants" :key="variant.id" type="button" :aria-pressed="activeTab === variant.id" class="rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand" :class="activeTab === variant.id ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-border'" @click="activeTab = variant.id">{{ variant.name || `Varian ${index + 1}` }}</button>
          </div>

          <div v-if="activeTab === 'base'" class="mt-5">
            <label class="seller-form-label" for="base-price">Harga Jual Dasar (IDR) *</label>
            <input id="base-price" v-model="basePrice" class="seller-form-input" type="text" inputmode="numeric" placeholder="0" :aria-invalid="Boolean(errors.price)" :aria-describedby="errors.price ? 'price-error' : undefined">
            <p v-if="errors.price" id="price-error" class="mt-1 text-sm text-red-700">{{ errors.price }}</p>
            <p class="mt-2 text-xs text-muted">Harga ini dipakai saat produk tidak memiliki varian.</p>
          </div>
          <div v-else-if="activeVariant" class="mt-5 space-y-4">
            <div>
              <label class="seller-form-label" :for="`variant-name-${activeVariant.id}`">Nama Varian *</label>
              <input :id="`variant-name-${activeVariant.id}`" v-model="activeVariant.name" class="seller-form-input" type="text" placeholder="Contoh: Hitam / Ukuran L">
            </div>
            <div>
              <label class="seller-form-label" :for="`variant-price-${activeVariant.id}`">Harga Jual Varian (IDR) *</label>
              <input :id="`variant-price-${activeVariant.id}`" v-model="activeVariant.price" class="seller-form-input" type="text" inputmode="numeric" placeholder="0">
            </div>
            <button type="button" class="text-sm font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-red-700" @click="removeVariant(activeVariant.id)">Hapus Varian</button>
          </div>
          <p v-if="errors.variants" class="mt-2 text-sm text-red-700" role="alert">{{ errors.variants }}</p>
        </section>

        <p v-if="saveError" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{{ saveError }}</p>
        <button type="submit" class="min-h-12 w-full rounded-md bg-brand px-5 text-base font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving || generating">
          {{ saving ? 'Menyimpan produk...' : 'Simpan Produk' }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { descriptionSource, parseRupiah } from '~/utils/product-form.mjs'

definePageMeta({ middleware: 'seller', layout: 'seller' })

type Photo = { file: File; preview: string; url?: string }
type Variant = { id: string; name: string; price: string }

const route = useRoute()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { data: trips, error: tripsError, refresh: refreshTrips } = await useFetch('/api/seller/trips')
const tripId = ref(typeof route.query.trip_id === 'string' ? route.query.trip_id : '')
const name = ref('')
const category = ref('')
const description = ref('')
const aiDraft = ref('')
const basePrice = ref('')
const photos = ref<Photo[]>([])
const variants = ref<Variant[]>([])
const activeTab = ref('base')
const activeVariant = computed(() => variants.value.find((variant) => variant.id === activeTab.value))
const errors = reactive<Record<string, string>>({})
const aiError = ref('')
const saveError = ref('')
const generating = ref(false)
const saving = ref(false)
const draftId = crypto.randomUUID()

watch(() => trips.value?.trips, (available) => {
  if (!tripId.value && available?.length) tripId.value = available[0].id
}, { immediate: true })

onUnmounted(() => photos.value.forEach((photo) => URL.revokeObjectURL(photo.preview)))

function addPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  errors.photos = ''
  for (const file of files) {
    if (photos.value.length >= 5) break
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { errors.photos = 'Pilih foto JPG, PNG, atau WebP.'; continue }
    if (file.size > 12 * 1024 * 1024) { errors.photos = 'Ukuran tiap foto maksimal 12 MB.'; continue }
    photos.value.push({ file, preview: URL.createObjectURL(file) })
  }
  input.value = ''
}

function removePhoto(index: number) {
  const [photo] = photos.value.splice(index, 1)
  if (photo) URL.revokeObjectURL(photo.preview)
}

function addVariant() {
  const id = crypto.randomUUID()
  variants.value.push({ id, name: '', price: '' })
  activeTab.value = id
}

function removeVariant(id: string) {
  variants.value = variants.value.filter((variant) => variant.id !== id)
  activeTab.value = 'base'
}

async function uploadPhoto(photo: Photo) {
  if (photo.url) return photo.url
  const sellerId = user.value?.sub
  if (!sellerId) throw new Error('Sesi seller tidak tersedia.')
  const bitmap = await createImageBitmap(photo.file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  if (!blob) throw new Error('Foto tidak dapat diproses.')
  const path = `${sellerId}/${draftId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('products').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  photo.url = supabase.storage.from('products').getPublicUrl(path).data.publicUrl
  return photo.url
}

async function generateDescription() {
  if (!name.value.trim() || !photos.value.length || generating.value) return
  generating.value = true
  aiError.value = ''
  try {
    const photo_url = await uploadPhoto(photos.value[0])
    const result = await $fetch('/api/ai/product-description', {
      method: 'POST',
      body: { name: name.value.trim(), category: category.value.trim(), photo_url }
    })
    aiDraft.value = result.description
    description.value = result.description
  } catch {
    aiError.value = 'Draft AI gagal dibuat. Anda tetap dapat menulis deskripsi secara manual.'
  } finally {
    generating.value = false
  }
}

async function submit() {
  Object.keys(errors).forEach((key) => delete errors[key])
  saveError.value = ''
  if (!tripId.value) errors.trip = 'Pilih trip untuk produk ini.'
  if (!name.value.trim()) errors.name = 'Nama produk wajib diisi.'
  if (!photos.value.length) errors.photos = 'Tambahkan minimal satu foto produk.'
  const price = parseRupiah(basePrice.value)
  if (price === null) errors.price = 'Masukkan harga dasar dalam rupiah tanpa desimal.'
  const invalidVariant = variants.value.find((variant) => !variant.name.trim() || parseRupiah(variant.price) === null)
  if (invalidVariant) {
    errors.variants = 'Isi nama dan harga jual untuk setiap varian.'
  }
  if (Object.keys(errors).length) {
    if (errors.price) activeTab.value = 'base'
    else if (invalidVariant) activeTab.value = invalidVariant.id
    await nextTick()
    const fieldId = errors.trip ? 'product-trip' : errors.name ? 'product-name' : errors.price ? 'base-price' : invalidVariant ? `variant-name-${invalidVariant.id}` : null
    if (fieldId) document.getElementById(fieldId)?.focus()
    return
  }

  saving.value = true
  let stage: 'upload' | 'save' = 'upload'
  try {
    const photoUrls = []
    for (const photo of photos.value) photoUrls.push(await uploadPhoto(photo))
    stage = 'save'
    await $fetch(`/api/seller/trips/${tripId.value}/products`, {
      method: 'POST',
      body: {
        name: name.value.trim(),
        category: category.value.trim(),
        description: description.value.trim(),
        description_source: descriptionSource(description.value.trim(), aiDraft.value),
        price,
        photos: photoUrls.map((photo_url, sort_order) => ({ photo_url, sort_order })),
        variants: variants.value.map((variant) => ({ name: variant.name.trim(), price: parseRupiah(variant.price) }))
      }
    })
    await navigateTo('/seller/products')
  } catch (error) {
    console.error(`Product ${stage} failed:`, error)
    saveError.value = stage === 'upload'
      ? 'Foto gagal diunggah. Periksa koneksi atau sesi akun, lalu coba lagi.'
      : 'Foto berhasil diunggah, tetapi produk gagal disimpan. Periksa data lalu coba lagi.'
  } finally {
    saving.value = false
  }
}
</script>
