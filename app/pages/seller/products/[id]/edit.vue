<template>
  <section class="seller-page">
    <div class="seller-page-inner">
      <AppPageTitle title="Edit Produk" back-to="/seller/products" back-label="Kembali ke Produk" />

      <div v-if="pending" class="mt-6 rounded-lg border border-border bg-white p-6 text-base text-muted" role="status">Memuat produk...</div>
      <div v-else-if="loadError || !product" class="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-base text-red-700" role="alert">
        Produk gagal dimuat atau tidak ditemukan.
        <button type="button" class="ml-1 font-semibold underline" @click="refresh()">Coba lagi</button>
      </div>

      <form v-else class="items-start gap-5 grid lg:grid-cols-[minmax(0,1fr)_24rem] mt-6" novalidate @submit.prevent="submit">
        <div class="space-y-5 min-w-0">
          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="edit-detail-title">
            <h2 id="edit-detail-title" class="border-b border-border pb-3 text-lg font-semibold">Detail Produk</h2>
            <div class="mt-5 space-y-5">
              <div>
                <label class="field-label" for="edit-product-name">Nama Produk <span class="text-red-600">*</span></label>
                <input id="edit-product-name" v-model="name" class="field-input" type="text" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'edit-name-error' : undefined">
                <p v-if="errors.name" id="edit-name-error" class="mt-1 text-sm text-red-700">{{ errors.name }}</p>
              </div>
              <div>
                <label class="field-label" for="edit-product-category">Kategori</label>
                <input id="edit-product-category" v-model="category" class="field-input" type="text" placeholder="Contoh: Perawatan kulit">
              </div>
              <div>
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label class="field-label mb-0" for="edit-product-description">Deskripsi</label>
                  <button type="button" class="rounded-md border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50" :disabled="generating || saving || !name.trim() || !photos.length" @click="generateDescription">
                    {{ generating ? 'Membuat draft...' : '✧ Draft dengan AI' }}
                  </button>
                </div>
                <textarea id="edit-product-description" v-model="description" class="field-input min-h-32 resize-y" placeholder="Deskripsi produk..." />
                <p v-if="aiError" class="mt-1 text-sm text-red-700" role="alert">{{ aiError }}</p>
              </div>
            </div>
          </section>

          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="edit-price-title">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 id="edit-price-title" class="text-lg font-semibold">Varian &amp; Harga</h2>
              <button type="button" class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand" @click="addVariant">+ Tambah Varian</button>
            </div>
            <AppTabs v-model="activeTab" :tabs="priceTabs" label="Harga dan varian" class="mt-4" />
            <div v-if="activeTab === 'base'" class="mt-5">
              <label class="field-label" for="edit-base-price">Harga Jual Dasar <span class="text-red-600">*</span></label>
              <AppNumberInput id="edit-base-price" v-model="basePrice" prefix="Rp" placeholder="0" :aria-invalid="Boolean(errors.price)" :aria-describedby="errors.price ? 'edit-price-error' : undefined" />
              <p v-if="errors.price" id="edit-price-error" class="mt-1 text-sm text-red-700">{{ errors.price }}</p>
              <p class="mt-2 text-sm text-muted">Dipakai saat produk tidak memiliki varian.</p>
            </div>
            <div v-else-if="activeVariant" class="mt-5 space-y-4">
              <div>
                <label class="field-label" :for="`edit-variant-name-${activeVariant.id}`">Nama Varian <span class="text-red-600">*</span></label>
                <input :id="`edit-variant-name-${activeVariant.id}`" v-model="activeVariant.name" class="field-input" type="text" placeholder="Contoh: 30 ml">
              </div>
              <div>
                <label class="field-label" :for="`edit-variant-price-${activeVariant.id}`">Harga Jual Varian <span class="text-red-600">*</span></label>
                <AppNumberInput :id="`edit-variant-price-${activeVariant.id}`" v-model="activeVariant.price" prefix="Rp" placeholder="0" />
              </div>
              <button type="button" class="text-sm font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-red-700" @click="removeVariant(activeVariant.id)">Hapus Varian</button>
            </div>
            <p v-if="errors.variants" class="mt-2 text-sm text-red-700" role="alert">{{ errors.variants }}</p>
          </section>
        </div>

        <div class="space-y-5">
          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="edit-photos-title">
            <h2 id="edit-photos-title" class="text-lg font-semibold">Foto Produk</h2>
            <p class="mt-1 text-sm text-muted">Minimal satu foto, maksimal lima foto.</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <div v-for="(photo, index) in photos" :key="photo.preview" class="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-canvas">
                <img :src="photo.preview" :alt="`Foto produk ${index + 1}`" class="h-full w-full object-cover">
                <button type="button" class="absolute right-1 top-1 rounded bg-white px-1.5 py-0.5 text-sm text-ink shadow hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand" :aria-label="`Hapus foto ${index + 1}`" @click="removePhoto(index)">×</button>
              </div>
              <label v-if="photos.length < 5" class="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted hover:border-brand hover:text-brand focus-within:outline-2 focus-within:outline-brand">
                <span aria-hidden="true" class="text-2xl leading-none">+</span>
                <span class="mt-1">Tambah</span>
                <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="addPhotos">
              </label>
            </div>
            <p v-if="errors.photos" class="mt-2 text-sm text-red-700" role="alert">{{ errors.photos }}</p>
          </section>
          <p v-if="saveError" class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{{ saveError }}</p>
          <button type="submit" class="min-h-12 w-full rounded-md bg-brand px-5 text-base font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving || generating">
            {{ saving ? 'Menyimpan perubahan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import AppTabs from '~/components/ui/AppTabs.vue'
import AppNumberInput from '~/components/ui/AppNumberInput.vue'
import { descriptionSource, parseRupiah } from '~/utils/product-form.mjs'

definePageMeta({ middleware: 'seller', layout: 'seller' })

type Photo = { file?: File; preview: string; url?: string }
type Variant = { id: string; name: string; price: string }

const route = useRoute()
const productId = String(route.params.id)
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { data, pending, error: loadError, refresh } = await useFetch(`/api/seller/products/${productId}`)
const product = computed(() => data.value?.product)
useHead({ title: () => product.value ? `Edit ${product.value.name}` : 'Edit Produk' })
const name = ref('')
const category = ref('')
const description = ref('')
const aiDraft = ref('')
const basePrice = ref('')
const photos = ref<Photo[]>([])
const variants = ref<Variant[]>([])
const initialPhotos = ref<string[]>([])
const initialVariants = ref<string>('')
const activeTab = ref('base')
const priceTabs = computed(() => [{ value: 'base', label: 'Harga Dasar' }, ...variants.value.map((variant, index) => ({ value: variant.id, label: variant.name || `Varian ${index + 1}` }))])
const activeVariant = computed(() => variants.value.find((variant) => variant.id === activeTab.value))
const errors = reactive<Record<string, string>>({})
const aiError = ref('')
const saveError = ref('')
const generating = ref(false)
const saving = ref(false)
const draftId = crypto.randomUUID()

watch(product, (value) => {
  if (!value) return
  name.value = value.name
  category.value = value.category ?? ''
  description.value = value.description ?? ''
  aiDraft.value = value.description_source === 'ai' ? description.value : ''
  basePrice.value = String(value.price)
  photos.value = [...(value.product_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((photo) => ({ preview: photo.photo_url, url: photo.photo_url }))
  initialPhotos.value = photos.value.map((photo) => photo.url!)
  variants.value = (value.product_variants ?? []).map((variant) => ({ id: variant.id, name: variant.name, price: String(variant.price) }))
  initialVariants.value = JSON.stringify(variants.value)
  activeTab.value = variants.value[0]?.id ?? 'base'
}, { immediate: true })

onUnmounted(() => photos.value.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.preview) }))

function addPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  errors.photos = ''
  for (const file of Array.from(input.files ?? [])) {
    if (photos.value.length >= 5) break
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { errors.photos = 'Pilih foto JPG, PNG, atau WebP.'; continue }
    if (file.size > 12 * 1024 * 1024) { errors.photos = 'Ukuran tiap foto maksimal 12 MB.'; continue }
    photos.value.push({ file, preview: URL.createObjectURL(file) })
  }
  input.value = ''
}

function removePhoto(index: number) {
  const [photo] = photos.value.splice(index, 1)
  if (photo?.file) URL.revokeObjectURL(photo.preview)
}

function addVariant() {
  const id = crypto.randomUUID()
  variants.value.push({ id, name: '', price: '' })
  activeTab.value = id
}

function removeVariant(id: string) {
  variants.value = variants.value.filter((variant) => variant.id !== id)
  activeTab.value = variants.value[0]?.id ?? 'base'
}

async function uploadPhoto(photo: Photo) {
  if (photo.url) return photo.url
  const sellerId = user.value?.sub
  if (!sellerId || !photo.file) throw new Error('Sesi seller atau foto tidak tersedia.')
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
    const photo_url = await uploadPhoto(photos.value[0]!)
    const result = await $fetch('/api/ai/product-description', { method: 'POST', body: { name: name.value.trim(), category: category.value.trim(), photo_url } })
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
  if (!name.value.trim()) errors.name = 'Nama produk wajib diisi.'
  if (!photos.value.length) errors.photos = 'Tambahkan minimal satu foto produk.'
  const price = parseRupiah(basePrice.value)
  if (price === null) errors.price = 'Masukkan harga dasar dalam rupiah tanpa desimal.'
  const invalidVariant = variants.value.find((variant) => !variant.name.trim() || parseRupiah(variant.price) === null)
  if (invalidVariant) errors.variants = 'Isi nama dan harga jual untuk setiap varian.'
  if (Object.keys(errors).length) {
    if (errors.price) activeTab.value = 'base'
    else if (invalidVariant) activeTab.value = invalidVariant.id
    await nextTick()
    document.getElementById(errors.name ? 'edit-product-name' : errors.price ? 'edit-base-price' : invalidVariant ? `edit-variant-name-${invalidVariant.id}` : '')?.focus()
    return
  }

  saving.value = true
  let stage: 'upload' | 'save' = 'upload'
  try {
    const photoUrls: string[] = []
    for (const photo of photos.value) photoUrls.push(await uploadPhoto(photo))
    stage = 'save'
    const body: Record<string, unknown> = {
      name: name.value.trim(), category: category.value.trim(), description: description.value.trim(),
      description_source: description.value.trim() === (product.value?.description ?? '')
        ? product.value?.description_source
        : descriptionSource(description.value.trim(), aiDraft.value),
      price
    }
    if (JSON.stringify(photoUrls) !== JSON.stringify(initialPhotos.value)) body.photos = photoUrls.map((photo_url, sort_order) => ({ photo_url, sort_order }))
    if (JSON.stringify(variants.value) !== initialVariants.value) {
      const originalIds = new Set((product.value?.product_variants ?? []).map((variant) => variant.id))
      body.variants = variants.value.map((variant) => ({
        ...(originalIds.has(variant.id) ? { id: variant.id } : {}),
        name: variant.name.trim(), price: parseRupiah(variant.price)
      }))
    }
    await $fetch(`/api/seller/products/${productId}`, { method: 'PATCH', body })
    await navigateTo('/seller/products')
  } catch (error) {
    console.error(`Product edit ${stage} failed:`, error)
    const statusCode = (error as { statusCode?: number }).statusCode
    saveError.value = stage === 'upload'
      ? 'Foto gagal diunggah. Periksa koneksi atau sesi akun, lalu coba lagi.'
      : statusCode === 409
        ? 'Varian yang sudah dipesan tidak dapat dihapus. Kembalikan varian tersebut lalu coba lagi.'
        : 'Perubahan gagal disimpan. Periksa data lalu coba lagi.'
  } finally {
    saving.value = false
  }
}
</script>
