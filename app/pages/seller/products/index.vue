<template>
  <section class="seller-page">
    <div class="seller-page-inner">
      <header class="seller-page-header">
        <div>
          <h1 class="seller-page-title">Produk</h1>
          <p class="mt-1 text-sm text-muted">{{ products?.products?.length ?? 0 }} produk {{ tripId ? 'dalam trip ini' : 'di semua trip' }}</p>
        </div>
        <NuxtLink to="/seller/products/new" class="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span aria-hidden="true" class="text-base font-normal leading-none">+</span> Tambah Produk
        </NuxtLink>
      </header>

      <div class="mt-6 max-w-70">
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted" for="trip-filter">Trip</label>
        <select id="trip-filter" v-model="tripId" class="min-h-11 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <option value="">Semua Trip</option>
          <option v-for="trip in trips?.trips ?? []" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
        </select>
      </div>

      <div class="mt-4 overflow-hidden rounded-md border border-border bg-white">
        <div v-if="pending" class="px-4 py-8 text-sm text-muted" role="status">Memuat produk...</div>
        <div v-else-if="error" class="flex flex-wrap items-center gap-3 px-4 py-8 text-sm text-red-700" role="alert">
          Produk gagal dimuat.
          <button type="button" class="font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2" @click="refresh()">Coba lagi</button>
        </div>
        <div v-else-if="!products?.products?.length" class="px-4 py-8 text-sm text-muted">
          {{ tripId ? 'Belum ada produk pada trip ini.' : 'Belum ada produk.' }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[640px] table-fixed text-left text-sm">
            <caption class="sr-only">Daftar produk seller</caption>
            <colgroup><col class="w-[47%]"><col class="w-[21%]"><col class="w-[17%]"><col class="w-[15%]"></colgroup>
            <thead class="border-b border-border bg-white text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">Produk</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Trip</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Harga</th>
                <th scope="col" class="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="product in visibleProducts" :key="product.id" class="hover:bg-canvas/35">
                <td class="px-4 py-2.5">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-canvas">
                      <img v-if="firstPhoto(product)" :src="firstPhoto(product)" alt="" class="h-full w-full object-cover" loading="lazy">
                    </div>
                    <div class="min-w-0">
                      <p class="truncate font-medium" :title="product.name">{{ product.name }}</p>
                      <p class="mt-0.5 text-xs text-muted">{{ product.product_variants?.length ?? 0 }} varian</p>
                    </div>
                  </div>
                </td>
                <td class="truncate px-4 py-2.5 text-muted" :title="tripName(product.trip_id)">{{ tripName(product.trip_id) }}</td>
                <td class="px-4 py-2.5 font-medium tabular-nums">{{ formatCurrency(product.price) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-end gap-1">
                    <NuxtLink :to="`/seller/products/${product.id}/edit`" class="rounded p-2 text-muted hover:bg-canvas hover:text-brand focus-visible:outline-2 focus-visible:outline-brand" :aria-label="`Edit ${product.name}`" title="Edit produk">
                      <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>
                    </NuxtLink>
                    <button type="button" class="rounded p-2 text-muted hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700" :aria-label="`Hapus ${product.name}`" title="Hapus produk" @click="askDelete(product)">
                      <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <button v-if="hasMore" type="button" class="mt-4 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:border-brand focus-visible:outline-2 focus-visible:outline-brand" @click="visibleCount += 20">Tampilkan lebih banyak</button>
    </div>

    <dialog ref="deleteDialog" class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-white p-0 text-ink shadow-xl backdrop:bg-black/35" @close="selectedProduct = null">
      <div class="p-6">
        <h2 class="text-lg font-semibold">Hapus produk?</h2>
        <p class="mt-2 text-sm text-muted">{{ selectedProduct?.name }} akan dihapus. Produk yang sudah dipesan tidak dapat dihapus.</p>
        <p v-if="dialogError" class="mt-3 text-sm text-red-700" role="alert">{{ dialogError }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="rounded-md border border-border px-4 py-2 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" :disabled="deleting" @click="deleteDialog?.close()">Batal</button>
          <button type="button" class="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-50" :disabled="deleting" @click="remove">{{ deleting ? 'Menghapus...' : 'Hapus produk' }}</button>
        </div>
      </div>
    </dialog>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'seller', layout: 'seller' })

type Product = { id: string; trip_id: string; name: string; price: number; product_photos?: { photo_url: string; sort_order: number }[]; product_variants?: { id: string }[] }

const tripId = ref('')
const visibleCount = ref(20)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const selectedProduct = ref<Product | null>(null)
const deleting = ref(false)
const dialogError = ref('')

const { data: trips } = await useFetch('/api/seller/trips')
const { data: products, pending, error, refresh } = await useFetch('/api/seller/products', {
  query: computed(() => ({ trip_id: tripId.value || undefined }))
})

const visibleProducts = computed(() => (products.value?.products ?? []).slice(0, visibleCount.value))
const hasMore = computed(() => (products.value?.products?.length ?? 0) > visibleCount.value)
const tripName = (id: string) => trips.value?.trips?.find((trip) => trip.id === id)?.title ?? '—'
const firstPhoto = (product: Product) => product.product_photos?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.photo_url
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

watch(tripId, () => { visibleCount.value = 20 })

function askDelete(product: Product) {
  selectedProduct.value = product
  dialogError.value = ''
  deleteDialog.value?.showModal()
}

async function remove() {
  if (!selectedProduct.value || deleting.value) return
  deleting.value = true
  dialogError.value = ''
  try {
    await $fetch(`/api/seller/products/${selectedProduct.value.id}`, { method: 'DELETE' })
    deleteDialog.value?.close()
    await refresh()
  } catch {
    dialogError.value = 'Produk gagal dihapus. Produk yang sudah dipesan tidak dapat dihapus.'
  } finally {
    deleting.value = false
  }
}
</script>
