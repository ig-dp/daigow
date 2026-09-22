<template>
  <main class="min-h-dvh bg-[#fafaf8] text-ink">
    <header class="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1440px] items-center gap-5 px-5 py-3 sm:px-8 lg:px-10">
        <NuxtLink :to="`/t/${slug}`" class="shrink-0 text-xl font-bold tracking-tight text-brand focus-visible:outline-2 focus-visible:outline-brand">DAIGOW</NuxtLink>
        <div class="relative ml-auto hidden w-full max-w-[480px] sm:block"><span class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span><input class="h-11 w-full rounded-lg bg-[#f0f1ee] pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40" placeholder="Cari produk di Trip ini..." aria-label="Cari produk" @keydown.enter="goToCatalog"></div>
        <NuxtLink :to="`/t/${slug}`" class="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand hover:bg-[#f0f1ee] focus-visible:outline-2 focus-visible:outline-brand" aria-label="Kembali ke katalog">Keranjang</NuxtLink>
      </div>
    </header>

    <div v-if="pending" class="mx-auto max-w-[1080px] px-5 py-12 text-base text-muted" role="status">Memuat produk...</div>
    <div v-else-if="error || !trip || !product" class="mx-auto max-w-[1080px] px-5 py-12">
      <h1 class="text-2xl font-semibold">Produk tidak ditemukan</h1><p class="mt-2 text-base text-muted">Produk ini mungkin sudah tidak tersedia.</p><NuxtLink :to="`/t/${slug}`" class="mt-5 inline-block font-semibold text-brand underline">Kembali ke katalog</NuxtLink>
    </div>

    <section v-else class="mx-auto max-w-[1080px] px-5 pb-16 pt-8 sm:px-8 lg:pt-10">
      <NuxtLink :to="`/t/${slug}`" class="inline-flex items-center gap-2 text-sm text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">← <span>Kembali ke produk</span></NuxtLink>
      <div class="mt-6 grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div class="overflow-hidden rounded-xl bg-[#e9ece9]">
          <img v-if="selectedPhoto" :src="selectedPhoto" :alt="product.name" class="aspect-square h-full w-full object-cover">
          <div v-else class="grid aspect-square place-items-center text-sm text-muted">Foto belum tersedia</div>
        </div>

        <div class="pt-1">
          <p v-if="product.category" class="text-sm font-medium text-brand">◉ {{ product.category }}</p>
          <h1 class="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-[34px]">{{ product.name }}</h1>
          <p v-if="product.description" class="mt-4 text-base leading-relaxed text-muted">{{ product.description }}</p>

          <fieldset v-if="product.product_variants?.length" class="mt-6">
            <legend class="text-xs font-bold uppercase tracking-[0.14em] text-muted">Varian</legend>
            <div class="mt-2 flex flex-wrap gap-2">
              <label v-for="variant in product.product_variants" :key="variant.id" class="cursor-pointer rounded-lg border px-4 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-[#f0f5f3] has-[:checked]:font-semibold">
                <input v-model="selectedVariantId" class="sr-only" type="radio" name="detail-variant" :value="variant.id">{{ variant.name }}
              </label>
            </div>
          </fieldset>

          <div class="mt-5 rounded-xl bg-[#eeefec] px-4 py-4 sm:px-5">
            <p class="text-sm text-muted">Harga Jual</p>
            <p class="mt-1 text-2xl font-bold tracking-wide tabular-nums text-ink">{{ formatCurrency(selectedPrice) }}</p>
            <p class="mt-2 text-sm text-muted">♢ Pembayaran aman via rekber escrow</p>
          </div>
          <button type="button" class="mt-5 min-h-12 w-full rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canOrder" @click="addToCart">{{ canOrder ? 'Tambah ke Keranjang' : orderMessage }}</button>
          <p v-if="feedback" class="mt-3 text-center text-sm text-brand" role="status">{{ feedback }}</p>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
type Variant = { id: string; name: string; price: number; photo_url?: string | null }
type Product = { id: string; name: string; category: string | null; description: string | null; price: number; product_photos: { photo_url: string; sort_order: number }[]; product_variants: Variant[] }
type Trip = { slug: string; status: string; order_open_at: string; order_close_at: string; products: Product[] }
const route = useRoute()
const slug = String(route.params.slug)
const productId = String(route.params.id)
const { data, pending, error } = await useFetch(`/api/trips/by-slug/${encodeURIComponent(slug)}`)
const trip = computed(() => data.value?.trip as Trip | undefined)
const product = computed(() => trip.value?.products?.find(item => item.id === productId))
const selectedVariantId = ref('')
const feedback = ref('')
const selectedVariant = computed(() => product.value?.product_variants?.find(item => item.id === selectedVariantId.value))
const selectedPhoto = computed(() => selectedVariant.value?.photo_url || [...(product.value?.product_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.photo_url)
const selectedPrice = computed(() => selectedVariant.value?.price ?? product.value?.price ?? 0)
const orderMessage = computed(() => {
  if (trip.value?.status === 'closed') return 'Trip sudah ditutup'
  if (trip.value?.status !== 'open') return 'Belum dapat dipesan'
  const now = Date.now()
  if (now < new Date(trip.value.order_open_at).getTime()) return 'Pemesanan belum dimulai'
  if (now > new Date(trip.value.order_close_at).getTime()) return 'Pemesanan sudah berakhir'
  return ''
})
const canOrder = computed(() => !!product.value && !orderMessage.value)
watch(product, value => { if (value?.product_variants?.length) selectedVariantId.value = value.product_variants[0].id }, { immediate: true })
useSeoMeta({ title: computed(() => product.value ? `${product.value.name} | Daigow` : 'Produk | Daigow'), description: computed(() => product.value?.description || 'Detail produk jastip Daigow.') })
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
function goToCatalog() { navigateTo(`/t/${slug}`) }
function addToCart() {
  if (!canOrder.value || !product.value) return
  const key = `daigow-cart:${slug}`
  const variantId = selectedVariant.value?.id ?? null
  try {
    const items = JSON.parse(localStorage.getItem(key) || '[]') as { productId: string; variantId?: string | null; quantity: number }[]
    const existing = items.find(item => item.productId === product.value?.id && (item.variantId ?? null) === variantId)
    if (existing) existing.quantity += 1
    else items.push({ productId: product.value.id, variantId, quantity: 1 })
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // The visual confirmation still lets the buyer continue if storage is unavailable.
  }
  feedback.value = 'Produk ditambahkan ke keranjang.'
}
</script>
