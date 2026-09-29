<template>
  <main class="min-h-dvh bg-[#fafaf8] text-ink">
    <header class="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1440px] items-center gap-5 px-5 py-3 sm:px-8 lg:px-10">
        <span class="flex shrink-0 items-baseline gap-2 text-xl font-bold tracking-tight text-brand"><img src="/logo.svg" alt="" class="h-[1.5cap] w-auto translate-y-[0.25cap]">DAIGOW</span>
        <label v-if="trip?.status !== 'coming_soon'" class="relative ml-auto hidden w-full max-w-[480px] sm:block">
          <span class="sr-only">Cari produk</span>
          <svg class="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
          <input v-model="search" type="search" class="h-11 w-full rounded-lg bg-[#f0f1ee] pl-11 pr-4 text-sm outline-none ring-brand/40 placeholder:text-muted focus:ring-2" placeholder="Cari produk di Trip ini...">
        </label>
        <button v-if="trip && trip.status !== 'coming_soon'" type="button" class="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand hover:bg-[#f0f1ee] focus-visible:outline-2 focus-visible:outline-brand sm:ml-0" @click="cartOpen = true">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4h2l2.3 11h11.5l2.2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
          <span class="hidden sm:inline">Keranjang</span><span v-if="cartCount" class="grid size-5 place-items-center rounded-full bg-brand text-[11px] text-white">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <div v-if="pending" class="mx-auto max-w-[1440px] px-5 py-12 text-base text-muted sm:px-8" role="status">Memuat Trip...</div>
    <div v-else-if="error || !trip" class="mx-auto max-w-[1440px] px-5 py-12 sm:px-8">
      <h1 class="text-2xl font-semibold">Trip tidak ditemukan</h1>
      <p class="mt-2 text-base text-muted">Periksa kembali link yang Anda terima.</p>
      <button type="button" class="mt-5 font-semibold text-brand underline" @click="refresh()">Coba lagi</button>
    </div>

    <template v-else>
      <section class="relative isolate min-h-[250px] overflow-hidden bg-brand text-white sm:min-h-[270px]" aria-labelledby="trip-title">
        <img v-if="trip.thumbnail_url && !coverFailed" :src="trip.thumbnail_url" alt="" class="absolute inset-0 h-full w-full object-cover" @error="coverFailed = true">
        <div class="absolute inset-0 bg-gradient-to-r from-[#102b28]/95 via-[#102b28]/75 to-[#102b28]/20" aria-hidden="true" />
        <div class="relative mx-auto flex min-h-[250px] max-w-[1440px] flex-col justify-end px-5 py-8 sm:min-h-[270px] sm:px-8 sm:py-10 lg:px-10">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{{ countryName(trip.destination) }}</p>
          <h1 id="trip-title" class="mt-2 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">{{ trip.title }}</h1>
          <p v-if="trip.description" class="mt-3 max-w-2xl line-clamp-2 text-sm leading-relaxed text-white/80 sm:text-base">{{ trip.description }}</p>
          <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            <span>Pemesanan: {{ formatDate(trip.order_open_at) }} – {{ formatDate(trip.order_close_at) }}</span>
            <span class="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold">{{ statusLabel }}</span>
          </div>
        </div>
      </section>

      <section v-if="trip.status === 'coming_soon'" class="mx-auto grid max-w-[1100px] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_22rem] lg:items-center" aria-labelledby="subscribe-title">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-brand">Segera hadir</p>
          <h2 id="subscribe-title" class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Nantikan katalog Trip ini</h2>
          <p class="mt-3 max-w-xl text-base leading-relaxed text-muted">Produk akan terlihat setelah Trip dibuka. Daftarkan email untuk menerima kabar pembukaannya.</p>
        </div>
        <form class="rounded-xl border border-border bg-white p-6" @submit.prevent="subscribe">
          <label for="subscriber-email" class="block text-sm font-semibold">Email Anda</label>
          <input id="subscriber-email" v-model="email" class="seller-form-input mt-2" type="email" autocomplete="email" required placeholder="nama@email.com" :disabled="subscribing || subscribed">
          <button type="submit" class="mt-3 min-h-12 w-full rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="subscribing || subscribed">{{ subscribing ? 'Mendaftarkan...' : subscribed ? 'Email terdaftar' : 'Daftarkan Email' }}</button>
          <p v-if="subscribeMessage" class="mt-3 text-sm" :class="subscribed ? 'text-brand' : 'text-red-700'" role="status">{{ subscribeMessage }}</p>
        </form>
      </section>

      <section v-else class="mx-auto grid max-w-[1440px] gap-8 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10 lg:px-10" aria-labelledby="catalog-title">
        <aside class="lg:pt-1" aria-label="Filter dan urutkan produk">
          <label for="catalog-sort" class="block text-xs font-bold uppercase tracking-[0.14em] text-muted">Urutkan</label>
          <AppSelect id="catalog-sort" v-model="sortBy" :options="SORT_OPTIONS" class="mt-2" />
          <fieldset v-if="categories.length" class="mt-6 border-t border-border pt-5">
            <legend class="text-xs font-bold uppercase tracking-[0.14em] text-muted">Kategori</legend>
            <label v-for="category in categories" :key="category" class="mt-3 flex cursor-pointer items-center gap-2 text-sm leading-snug"><input v-model="selectedCategories" type="checkbox" :value="category" class="size-4 accent-brand"><span>{{ category }}</span></label>
          </fieldset>
        </aside>

        <div class="min-w-0">
          <h2 id="catalog-title" class="text-2xl font-semibold tracking-tight">Explore</h2>
          <p class="mt-1 text-sm text-muted">{{ filteredProducts.length }} dari {{ trip.products?.length ?? 0 }} produk</p>
          <label class="mt-5 block sm:hidden"><span class="sr-only">Cari produk</span><input v-model="search" type="search" class="min-h-11 w-full rounded-lg border border-border bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-brand" placeholder="Cari produk di Trip ini..."></label>
          <p v-if="!canOrder" class="mt-5 rounded-lg border border-border bg-white p-4 text-sm text-muted">{{ trip.status === 'closed' ? 'Trip ini sudah ditutup. Katalog masih dapat dilihat.' : orderWindowMessage }}</p>
          <div v-if="!filteredProducts.length" class="mt-5 rounded-xl border border-border bg-white p-8 text-base text-muted">{{ trip.products?.length ? 'Tidak ada produk yang cocok. Coba kata kunci atau kategori lain.' : 'Belum ada produk pada Trip ini.' }}</div>
          <div v-else class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <article v-for="product in visibleProducts" :key="product.id" class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-[0_2px_12px_rgba(16,43,40,0.03)]">
              <NuxtLink :to="`/t/${trip.slug}/p/${product.id}`" class="block aspect-[4/3] overflow-hidden bg-[#e9ece9] focus-visible:outline-2 focus-visible:outline-brand"><img v-if="firstPhoto(product)" :src="firstPhoto(product)" :alt="product.name" class="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]" loading="lazy"><div v-else class="grid h-full place-items-center text-sm text-muted">Foto belum tersedia</div></NuxtLink>
              <div class="flex flex-1 flex-col p-4">
                <p v-if="product.category" class="text-xs font-medium text-muted">{{ product.category }}</p>
                <h3 class="mt-1 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug"><NuxtLink :to="`/t/${trip.slug}/p/${product.id}`" class="hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">{{ product.name }}</NuxtLink></h3>
                <p v-if="product.description" class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{{ product.description }}</p>
                <div class="mt-auto space-y-3 pt-5"><p class="text-lg font-bold tabular-nums leading-tight text-brand">{{ priceLabel(product) }}</p><button v-if="canOrder" type="button" class="min-h-10 w-full rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" :aria-label="`Tambah ${product.name} ke keranjang`" @click="chooseProduct(product)">+ Keranjang</button></div>
              </div>
            </article>
          </div>
          <button v-if="hasMore" type="button" class="mt-6 min-h-11 rounded-lg border border-brand px-5 text-sm font-semibold text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-brand" @click="visibleCount += 18">Tampilkan produk lainnya</button>
        </div>
      </section>
    </template>

    <div v-if="chosenProduct" class="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" @click.self="chosenProduct = null" @keydown.esc="chosenProduct = null">
      <section role="dialog" aria-modal="true" aria-labelledby="variant-title" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4"><h2 id="variant-title" class="text-xl font-semibold">Pilih varian</h2><button type="button" autofocus class="text-2xl leading-none text-muted hover:text-ink" aria-label="Tutup" @click="chosenProduct = null">×</button></div>
        <p class="mt-2 text-sm text-muted">{{ chosenProduct.name }}</p>
        <fieldset class="mt-5 space-y-2"><legend class="mb-2 text-sm font-semibold">Varian produk</legend><label v-for="variant in chosenProduct.product_variants" :key="variant.id" class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-[#f0f5f3]"><span class="flex items-center gap-3"><input v-model="selectedVariantId" type="radio" :value="variant.id" name="product-variant" class="size-4 accent-brand">{{ variant.name }}</span><span class="shrink-0 font-semibold tabular-nums">{{ formatCurrency(variant.price) }}</span></label></fieldset>
        <button type="button" class="mt-6 min-h-12 w-full rounded-lg bg-brand font-semibold text-white hover:bg-brand-hover disabled:opacity-50" :disabled="!selectedVariantId" @click="addChosenVariant">Tambah ke keranjang</button>
      </section>
    </div>

    <div v-if="cartOpen" class="fixed inset-0 z-50 flex justify-end bg-black/55" @click.self="cartOpen = false" @keydown.esc="cartOpen = false">
      <section role="dialog" aria-modal="true" aria-labelledby="cart-title" class="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-border px-6 py-5"><h2 id="cart-title" class="text-xl font-semibold">Keranjang <span class="text-sm font-normal text-muted">({{ cartCount }})</span></h2><button type="button" autofocus class="text-2xl leading-none text-muted hover:text-ink" aria-label="Tutup keranjang" @click="cartOpen = false">×</button></div>
        <div v-if="!cart.length" class="flex-1 px-6 py-10 text-sm text-muted">Keranjang masih kosong. Pilih produk dari katalog Trip ini.</div>
        <ul v-else class="flex-1 divide-y divide-border overflow-y-auto px-6"><li v-for="item in cart" :key="cartKey(item)" class="flex gap-3 py-4"><img v-if="firstPhoto(item.product)" :src="firstPhoto(item.product)" :alt="item.product.name" class="size-16 shrink-0 rounded-lg object-cover"><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-semibold leading-snug">{{ item.product.name }}</p><p v-if="item.variant" class="mt-1 text-xs text-muted">{{ item.variant.name }}</p><p class="mt-1 text-sm font-semibold tabular-nums text-brand">{{ formatCurrency(itemPrice(item)) }} <span v-if="item.quantity > 1" class="font-normal text-muted">× {{ item.quantity }}</span></p></div><button type="button" class="shrink-0 text-xs text-red-600 hover:underline" @click="removeItem(item)">Hapus</button></div><div class="mt-3 flex items-center gap-3"><button type="button" class="grid size-8 place-items-center rounded border border-border" :aria-label="`Kurangi ${item.product.name}`" @click="changeQuantity(item, -1)">−</button><span class="text-sm tabular-nums">{{ item.quantity }}</span><button type="button" class="grid size-8 place-items-center rounded border border-border" :aria-label="`Tambah ${item.product.name}`" @click="changeQuantity(item, 1)">+</button></div></div></li></ul>
        <div v-if="cart.length" class="border-t border-border px-6 py-5"><dl class="space-y-2 text-sm"><div class="flex justify-between gap-3"><dt class="text-muted">Subtotal</dt><dd class="tabular-nums">{{ formatCurrency(cartSubtotal) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-muted">Biaya platform (1,5%)</dt><dd class="tabular-nums">{{ formatCurrency(cartPlatformFee) }}</dd></div><div class="flex justify-between gap-3 border-t border-border pt-3 font-semibold"><dt>Total sementara</dt><dd class="tabular-nums">{{ formatCurrency(cartTotal) }}</dd></div></dl><button type="button" class="mt-4 min-h-12 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand" @click="navigateTo(`/t/${slug}/checkout`)">Lanjut ke Checkout</button></div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import AppSelect from '~/components/ui/AppSelect.vue'
type PublicVariant = { id: string; name: string; price: number }
type PublicProduct = { id: string; name: string; category: string | null; description: string | null; price: number; created_at: string; product_photos: { photo_url: string; sort_order: number }[]; product_variants: PublicVariant[] }
type PublicTrip = { id: string; slug: string; title: string; destination: string; description: string | null; thumbnail_url: string | null; order_open_at: string; order_close_at: string; status: string; products: PublicProduct[] }
type CartItem = { product: PublicProduct; variant: PublicVariant | null; quantity: number }

const route = useRoute()
const slug = String(route.params.slug)
const { data, pending, error, refresh } = await useFetch(`/api/trips/by-slug/${encodeURIComponent(slug)}`)
const trip = computed(() => data.value?.trip as PublicTrip | undefined)
const coverFailed = ref(false)
const email = ref('')
const subscribing = ref(false)
const subscribed = ref(false)
const subscribeMessage = ref('')
const search = ref('')
const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'low', label: 'Harga: rendah ke tinggi' },
  { value: 'high', label: 'Harga: tinggi ke rendah' }
]
const sortBy = ref('newest')
const selectedCategories = ref<string[]>([])
const visibleCount = ref(18)
const cart = ref<CartItem[]>([])
const cartOpen = ref(false)
const chosenProduct = ref<PublicProduct | null>(null)
const selectedVariantId = ref('')

const statusLabel = computed(() => trip.value?.status === 'coming_soon' ? 'Segera hadir' : trip.value?.status === 'closed' ? 'Trip ditutup' : 'Trip dibuka')
const categories = computed(() => [...new Set((trip.value?.products ?? []).map(product => product.category).filter((category): category is string => !!category))].sort((a, b) => a.localeCompare(b, 'id-ID')))
const orderWindowMessage = computed(() => {
  if (trip.value?.status !== 'open') return ''
  const now = Date.now()
  if (now < new Date(trip.value.order_open_at).getTime()) return 'Periode pemesanan belum dimulai.'
  if (now > new Date(trip.value.order_close_at).getTime()) return 'Periode pemesanan sudah berakhir.'
  return ''
})
const canOrder = computed(() => trip.value?.status === 'open' && !orderWindowMessage.value)
const filteredProducts = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('id-ID')
  const products = (trip.value?.products ?? []).filter(product => {
    const matchesSearch = !query || `${product.name} ${product.category ?? ''} ${product.description ?? ''}`.toLocaleLowerCase('id-ID').includes(query)
    return matchesSearch && (!selectedCategories.value.length || (!!product.category && selectedCategories.value.includes(product.category)))
  })
  return [...products].sort((a, b) => sortBy.value === 'low' ? productPrice(a) - productPrice(b) : sortBy.value === 'high' ? productPrice(b) - productPrice(a) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})
const visibleProducts = computed(() => filteredProducts.value.slice(0, visibleCount.value))
const hasMore = computed(() => filteredProducts.value.length > visibleCount.value)
const cartCount = computed(() => cart.value.reduce((total, item) => total + item.quantity, 0))
const cartSubtotal = computed(() => cart.value.reduce((total, item) => total + itemPrice(item) * item.quantity, 0))
const cartPlatformFee = computed(() => Math.round(cartSubtotal.value * 0.015))
const cartTotal = computed(() => cartSubtotal.value + cartPlatformFee.value)
const cartStorageKey = `daigow-cart:${slug}`
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(cartStorageKey) || '[]') as { productId: string; variantId?: string | null; quantity: number }[]
    cart.value = saved.flatMap(entry => {
      const product = trip.value?.products.find(item => item.id === entry.productId)
      const variant = product?.product_variants.find(item => item.id === entry.variantId) ?? null
      return product && entry.quantity > 0 ? [{ product, variant, quantity: entry.quantity }] : []
    })
  } catch { cart.value = [] }
})
watch(cart, value => {
  if (import.meta.client) localStorage.setItem(cartStorageKey, JSON.stringify(value.map(item => ({ productId: item.product.id, variantId: item.variant?.id ?? null, quantity: item.quantity }))))
}, { deep: true })
watch([search, selectedCategories, sortBy], () => { visibleCount.value = 18 }, { deep: true })
useSeoMeta({ title: computed(() => trip.value ? `${trip.value.title} | Daigow` : 'Trip | Daigow'), description: computed(() => trip.value?.description || `Lihat katalog Trip ${trip.value?.title ?? ''} di Daigow.`) })

const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const firstPhoto = (product: PublicProduct) => [...(product.product_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.photo_url
const productPrice = (product: PublicProduct) => product.product_variants?.length ? Math.min(...product.product_variants.map(variant => variant.price)) : product.price
const priceLabel = (product: PublicProduct) => `${product.product_variants?.length ? 'Mulai ' : ''}${formatCurrency(productPrice(product))}`
const itemPrice = (item: CartItem) => item.variant?.price ?? item.product.price
const cartKey = (item: CartItem) => `${item.product.id}:${item.variant?.id ?? ''}`
function chooseProduct(product: PublicProduct) {
  if (!canOrder.value) return
  if (product.product_variants?.length) { selectedVariantId.value = ''; chosenProduct.value = product; return }
  addToCart(product, null)
}
function addChosenVariant() {
  if (!chosenProduct.value) return
  const variant = chosenProduct.value.product_variants.find(item => item.id === selectedVariantId.value)
  if (!variant) return
  addToCart(chosenProduct.value, variant)
  chosenProduct.value = null
}
function addToCart(product: PublicProduct, variant: PublicVariant | null) {
  if (!canOrder.value) return
  const existing = cart.value.find(item => item.product.id === product.id && item.variant?.id === variant?.id)
  if (existing) existing.quantity += 1
  else cart.value.push({ product, variant, quantity: 1 })
  cartOpen.value = true
}
function changeQuantity(item: CartItem, amount: number) {
  if (item.quantity + amount < 1) { removeItem(item); return }
  item.quantity += amount
}
function removeItem(item: CartItem) { cart.value = cart.value.filter(entry => entry !== item) }
async function subscribe() {
  if (!trip.value || subscribing.value || subscribed.value) return
  subscribing.value = true
  subscribeMessage.value = ''
  try {
    await $fetch(`/api/trips/${trip.value.id}/subscribe`, { method: 'POST', body: { email: email.value.trim() } })
    subscribed.value = true
    subscribeMessage.value = 'Email berhasil didaftarkan.'
  } catch {
    subscribeMessage.value = 'Email gagal didaftarkan. Coba lagi.'
  } finally {
    subscribing.value = false
  }
}
</script>
