<template>
  <main class="min-h-dvh bg-[#fafaf8] text-ink">
    <header class="border-b border-border bg-white"><div class="mx-auto max-w-[900px] px-5 py-4 sm:px-8"><NuxtLink to="/" class="text-xl font-bold tracking-tight text-brand">DAIGOW</NuxtLink></div></header>
    <section class="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
      <AppPageTitle title="Status Pesanan" back-to="/" back-label="Beranda" class="mb-6" />
      <div v-if="pending" class="rounded-xl border border-border bg-white p-6 text-sm text-muted">Memuat status pesanan...</div>
      <div v-else-if="error || !order" class="rounded-xl border border-border bg-white p-6"><h1 class="text-lg font-semibold">Pesanan tidak ditemukan</h1><p class="mt-2 text-sm text-muted">Link tracking mungkin sudah tidak valid.</p></div>
      <section v-else class="rounded-xl border border-border bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div><p class="text-xs uppercase tracking-[0.14em] text-muted">Nomor pesanan</p><p class="mt-1 text-lg font-semibold">{{ order.order_number }}</p></div>
          <div class="flex items-center gap-2">
            <span class="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">{{ statusLabel }}</span>
            <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="pending" aria-label="Perbarui status pesanan" title="Perbarui status" @click="refresh"><Icon name="material-symbols:refresh-rounded" class="text-lg" aria-hidden="true" /></button>
            <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand" :aria-label="copied ? 'Link tracking tersalin' : 'Salin link tracking'" :title="copied ? 'Link tersalin' : 'Salin link tracking'" @click="copyLink"><Icon :name="copied ? 'material-symbols:check-rounded' : 'material-symbols:content-copy-rounded'" class="text-lg" aria-hidden="true" /></button>
          </div>
        </div>
        <div class="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p><span class="text-muted">Nama:</span> {{ order.buyer_name }}</p><p><span class="text-muted">Total:</span> {{ formatCurrency(order.total_amount) }}</p></div>
        <p class="mt-5 rounded-lg bg-[#f0f5f3] p-4 text-sm">{{ statusMessage }}</p>
        <section v-if="order.tracking_number || safeEvidenceUrl" class="mt-5 rounded-xl border border-border bg-[#fafaf8] p-4" aria-labelledby="shipping-info-title">
          <h2 id="shipping-info-title" class="text-sm font-semibold">Info Pengiriman</h2>
          <dl class="mt-3 space-y-2 text-sm">
            <div v-if="order.tracking_number" class="flex flex-wrap justify-between gap-3"><dt class="text-muted">Nomor resi</dt><dd class="font-semibold break-all">{{ order.tracking_number }}</dd></div>
            <div v-if="safeEvidenceUrl" class="flex flex-wrap justify-between gap-3"><dt class="text-muted">Bukti pengiriman</dt><dd><a :href="safeEvidenceUrl" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand underline">Lihat bukti pengiriman</a></dd></div>
          </dl>
        </section>
        <div v-if="order.status === 'awaiting_payment'" class="mt-5 rounded-xl border border-border bg-[#fafaf8] p-4"><label for="payment-method" class="block text-sm font-semibold">Metode pembayaran</label><select id="payment-method" v-model="paymentMethod" class="mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"><option value="va">Virtual Account (BCA)</option><option value="qris">QRIS</option></select><button v-if="!payment" type="button" class="mt-3 min-h-11 w-full rounded-lg bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50" :disabled="paying" @click="pay">{{ paying ? 'Memproses...' : 'Buka pembayaran Xendit' }}</button><div v-if="payment" class="mt-4 rounded-lg border border-border bg-white p-4 text-sm"><p class="font-semibold text-brand">Pembayaran siap</p><p class="mt-1">Total: {{ formatCurrency(payment.amount) }}</p><p>Berlaku sampai: {{ formatDate(payment.expires_at) }}</p><a v-if="payment.payment_link_url" :href="payment.payment_link_url" target="_blank" rel="noopener noreferrer" class="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">Lanjut ke halaman pembayaran</a><div v-else-if="paymentInstruction" class="mt-3 rounded-lg bg-[#f0f5f3] p-3"><p class="text-xs uppercase tracking-wide text-muted">{{ paymentMethod === 'va' ? 'Nomor Virtual Account' : 'QRIS' }}</p><p class="mt-1 break-all font-semibold">{{ paymentInstruction }}</p><button v-if="paymentMethod === 'va'" type="button" class="mt-2 text-xs font-semibold text-brand underline" @click="copyPaymentInstruction">{{ paymentCopied ? 'Nomor tersalin' : 'Salin nomor VA' }}</button></div></div><p v-if="paymentError" class="mt-3 text-sm text-red-700">{{ paymentError }}</p></div>
        <div v-if="order.status === 'shipped' || order.status === 'delivered' || order.status === 'processing'" class="mt-5 flex flex-wrap gap-3"><button v-if="order.status === 'shipped'" type="button" class="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50" :disabled="actionBusy" @click="runBuyerAction('mark-delivered')">{{ actionBusy ? 'Memproses...' : 'Pesanan sudah diterima' }}</button><button v-if="order.status === 'delivered'" type="button" class="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50" :disabled="actionBusy" @click="runBuyerAction('confirm-received')">{{ actionBusy ? 'Memproses...' : 'Konfirmasi barang diterima' }}</button><button v-if="!order.issue_reported_at" type="button" class="min-h-11 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50" :disabled="actionBusy" @click="issueOpen = true">Laporkan masalah</button></div>
        <div v-if="issueOpen" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><label for="issue-note" class="block text-sm font-semibold text-red-900">Jelaskan masalah</label><textarea id="issue-note" v-model="issueNote" rows="3" class="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" placeholder="Contoh: barang rusak atau tidak sesuai pesanan." /><div class="mt-3 flex gap-3"><button type="button" class="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50" :disabled="actionBusy || !issueNote.trim()" @click="runBuyerAction('report-issue')">Kirim laporan</button><button type="button" class="min-h-10 rounded-lg border border-border bg-white px-4 text-sm" @click="issueOpen = false">Batal</button></div></div>
        <p v-if="actionMessage" class="mt-4 text-sm text-brand" role="status">{{ actionMessage }}</p><p v-if="actionError" class="mt-4 text-sm text-red-700" role="alert">{{ actionError }}</p>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
const route = useRoute()
const token = String(route.params.token)
const { data, pending, error, refresh } = await useFetch(`/api/orders/track/${encodeURIComponent(token)}`)
const order = computed(() => data.value?.order)
const paying = ref(false)
const paymentError = ref('')
const payment = ref<{ amount: number; expires_at: string; payment_link_url?: string; provider: Record<string, any> } | null>(null)
const paymentMethod = ref<'va' | 'qris'>('va')
const paymentCopied = ref(false)
const actionBusy = ref(false)
const actionMessage = ref('')
const actionError = ref('')
const issueOpen = ref(false)
const issueNote = ref('')
const labels: Record<string, string> = { awaiting_confirmation: 'Menunggu konfirmasi', awaiting_payment: 'Menunggu pembayaran', processing: 'Diproses', shipped: 'Dikirim', delivered: 'Terkirim', completed: 'Selesai', cancelled: 'Dibatalkan' }
const statusLabel = computed(() => labels[order.value?.status ?? ''] ?? order.value?.status ?? '')
const statusMessage = computed(() => order.value?.status === 'awaiting_confirmation' ? 'Pesanan sudah diterima. Seller sedang meninjau pesanan Anda.' : order.value?.status === 'awaiting_payment' ? 'Seller sudah mengonfirmasi pesanan. Silakan lanjutkan pembayaran.' : order.value?.status === 'processing' ? 'Pembayaran diterima. Seller sedang menyiapkan pesanan Anda.' : order.value?.status === 'shipped' ? 'Pesanan sedang dikirim. Konfirmasi setelah barang sampai.' : order.value?.status === 'delivered' ? 'Pesanan ditandai terkirim. Konfirmasi jika barang sudah sesuai.' : order.value?.status === 'cancelled' ? 'Pesanan dibatalkan.' : order.value?.status === 'completed' ? 'Pesanan selesai. Dana akan diteruskan ke seller.' : 'Status pesanan diperbarui.')
const safeEvidenceUrl = computed(() => {
  try {
    const url = new URL(order.value?.shipping_evidence_url ?? '')
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
})
const paymentInstruction = computed(() => {
  const provider = payment.value?.provider ?? {}
  const properties = provider.channel_properties ?? provider.payment_method?.channel_properties ?? {}
  const action = Array.isArray(provider.actions) ? provider.actions.find((item: any) => item.type === 'PRESENT_TO_CUSTOMER') : null
  return paymentMethod.value === 'va'
    ? properties.virtual_account_number ?? provider.virtual_account_number ?? action?.value ?? ''
    : properties.qr_string ?? provider.qr_string ?? action?.value ?? ''
})
async function pay() {
  if (!order.value || paying.value) return
  paying.value = true; paymentError.value = ''
  const paymentWindow = import.meta.client ? window.open('about:blank', '_blank') : null
  try {
    const result = await $fetch<{ payment: typeof payment.value }>(`/api/orders/${order.value.id}/checkout`, { method: 'POST', body: { method: paymentMethod.value }, headers: { 'x-tracking-token': token } })
    payment.value = result.payment
    if (paymentWindow && result.payment?.payment_link_url) paymentWindow.location.href = result.payment.payment_link_url
    else if (paymentWindow) paymentWindow.close()
  } catch (err: any) {
    paymentWindow?.close()
    paymentError.value = err?.data?.error?.message || 'Pembayaran gagal dibuat. Coba lagi.'
  } finally { paying.value = false }
}
async function runBuyerAction(action: 'mark-delivered' | 'confirm-received' | 'report-issue') {
  if (!order.value || actionBusy.value) return
  actionBusy.value = true; actionError.value = ''; actionMessage.value = ''
  try {
    await $fetch(`/api/orders/${order.value.id}/${action}`, { method: 'POST', body: action === 'report-issue' ? { note: issueNote.value.trim() } : undefined, headers: { 'x-tracking-token': token } })
    issueOpen.value = false; issueNote.value = ''; actionMessage.value = action === 'report-issue' ? 'Laporan berhasil dikirim.' : 'Status pesanan berhasil diperbarui.'
    await refresh()
  } catch (err: any) { actionError.value = err?.data?.error?.message || 'Aksi gagal. Coba lagi.' } finally { actionBusy.value = false }
}
async function copyPaymentInstruction() { if (!paymentInstruction.value) return; await navigator.clipboard.writeText(String(paymentInstruction.value)); paymentCopied.value = true; setTimeout(() => { paymentCopied.value = false }, 2000) }
const copied = ref(false)
async function copyLink() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
</script>
