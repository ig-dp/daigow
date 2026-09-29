<template>
  <main class="min-h-dvh bg-[#fafaf8] text-ink">
    <header class="border-b border-border bg-white">
      <div class="mx-auto flex max-w-[1100px] items-center px-5 py-4 sm:px-8">
        <NuxtLink :to="`/t/${slug}`" class="text-xl font-bold tracking-tight text-brand">DAIGOW</NuxtLink>
      </div>
    </header>
    <section class="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">
      <AppPageTitle title="Checkout" :back-to="`/t/${slug}`" back-label="Kembali ke katalog" class="mb-6" />
      <div v-if="!cart.length" class="rounded-xl border border-border bg-white p-6 text-sm text-muted">Keranjang kosong. Pilih produk terlebih dahulu.</div>
      <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form class="rounded-xl border border-border bg-white p-6" @submit.prevent="submitOrder">
          <h2 class="border-b border-border pb-4 text-sm font-semibold">Data Pemesan</h2>
          <div class="mt-5 space-y-4">
            <AppTextField v-model="form.buyer_name" id="buyer-name" name="buyer_name" label="Nama Lengkap *" autocomplete="name" :error="fieldErrors.buyer_name" />
            <AppTextField v-model="form.buyer_email" id="buyer-email" name="buyer_email" label="Email *" type="email" autocomplete="email" :error="fieldErrors.buyer_email" />
            <AppTextField v-model="form.buyer_phone" id="buyer-phone" name="buyer_phone" label="Nomor Telepon *" type="tel" autocomplete="tel" :error="fieldErrors.buyer_phone" />
            <div><label for="shipping-address" class="field-label">Alamat Pengiriman <span class="text-red-600">*</span></label><textarea id="shipping-address" v-model="form.shipping_address" name="shipping_address" rows="4" class="field-input" :aria-invalid="Boolean(fieldErrors.shipping_address)" /><p v-if="fieldErrors.shipping_address" class="field-error">{{ fieldErrors.shipping_address }}</p></div>
          </div>
          <p v-if="message" class="mt-4 text-sm text-red-700" role="alert">{{ message }}</p>
          <AppButton type="submit" class="mt-5" :disabled="submitting">{{ submitting ? 'Memproses...' : 'Buat Pesanan' }}</AppButton>
        </form>
        <aside class="h-fit rounded-xl border border-border bg-white p-6">
          <h2 class="border-b border-border pb-4 text-sm font-semibold">Ringkasan Pesanan</h2>
          <ul class="divide-y divide-border text-sm"><li v-for="item in cart" :key="`${item.productId}:${item.variantId ?? ''}`" class="flex justify-between gap-3 py-3"><span>{{ item.name }}<small v-if="item.variantName" class="block text-muted">{{ item.variantName }} × {{ item.quantity }}</small><small v-else class="block text-muted">× {{ item.quantity }}</small></span><span class="shrink-0 tabular-nums">{{ formatCurrency(item.price * item.quantity) }}</span></li></ul>
          <dl class="mt-3 space-y-2 border-t border-border pt-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-muted">Subtotal</dt><dd class="tabular-nums">{{ formatCurrency(subtotal) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-muted">Biaya platform (1,5%)</dt><dd class="tabular-nums">{{ formatCurrency(platformFee) }}</dd></div><div class="flex justify-between gap-3 border-t border-border pt-3 font-semibold"><dt>Total sementara</dt><dd class="tabular-nums">{{ formatCurrency(totalBeforeChannelFee) }}</dd></div></dl>
          <p class="mt-3 text-xs text-muted">Biaya channel pembayaran dapat ditambahkan setelah Anda memilih metode pembayaran.</p>
        </aside>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import AppTextField from '~/components/ui/AppTextField.vue'

type CartRow = { productId: string; variantId?: string | null; quantity: number; name: string; variantName?: string; price: number }
const route = useRoute()
const slug = String(route.params.slug)
const form = reactive({ buyer_name: '', buyer_email: '', buyer_phone: '', shipping_address: '' })
const fieldErrors = reactive<Record<string, string>>({})
const cart = ref<CartRow[]>([])
const submitting = ref(false)
const message = ref('')
const tripId = ref('')
const subtotal = computed(() => cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0))
const platformFee = computed(() => Math.round(subtotal.value * 0.015))
const totalBeforeChannelFee = computed(() => subtotal.value + platformFee.value)
const cartStorageKey = `daigow-cart:${slug}`

onMounted(async () => {
  try {
    const saved = JSON.parse(localStorage.getItem(cartStorageKey) || '[]') as { productId: string; variantId?: string | null; quantity: number }[]
    const { trip } = await $fetch<{ trip: any }>(`/api/trips/by-slug/${encodeURIComponent(slug)}`)
    tripId.value = trip.id
    cart.value = saved.flatMap(entry => {
      const product = trip.products.find((item: any) => item.id === entry.productId)
      const variant = product?.product_variants?.find((item: any) => item.id === entry.variantId)
      return product && Number.isInteger(entry.quantity) && entry.quantity > 0 && (!product.product_variants?.length || variant) ? [{ productId: product.id, variantId: variant?.id ?? null, quantity: entry.quantity, name: product.name, variantName: variant?.name, price: variant?.price ?? product.price }] : []
    })
  } catch { cart.value = [] }
})

function validate() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  if (!form.buyer_name.trim()) fieldErrors.buyer_name = 'Nama wajib diisi.'
  if (!/^\S+@\S+\.\S+$/.test(form.buyer_email.trim())) fieldErrors.buyer_email = 'Email tidak valid.'
  if (!form.buyer_phone.trim()) fieldErrors.buyer_phone = 'Nomor telepon wajib diisi.'
  if (!form.shipping_address.trim()) fieldErrors.shipping_address = 'Alamat wajib diisi.'
  return !Object.keys(fieldErrors).length
}
async function submitOrder() {
  if (!validate() || submitting.value || !cart.value.length) return
  submitting.value = true; message.value = ''
  try {
    const result = await $fetch<{ order_id: string; tracking_token: string }>('/api/orders', { method: 'POST', body: { trip_id: tripId.value, items: cart.value.map(item => ({ product_id: item.productId, ...(item.variantId ? { variant_id: item.variantId } : {}), quantity: item.quantity })), ...form } })
    localStorage.removeItem(cartStorageKey)
    await navigateTo(`/orders/track/${result.tracking_token}`)
  } catch { message.value = 'Pesanan gagal dibuat. Periksa data lalu coba lagi.' } finally { submitting.value = false }
}
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
</script>
