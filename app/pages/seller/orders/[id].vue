<template>
  <section class="seller-page">
    <div class="seller-detail-column">
      <NuxtLink to="/seller/orders" class="inline-flex items-center gap-2 text-sm text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span aria-hidden="true">←</span> Kembali ke Pesanan
      </NuxtLink>

      <div v-if="pending" class="mt-6 rounded-lg border border-border bg-white p-6 text-base text-muted" role="status">Memuat detail pesanan...</div>
      <div v-else-if="loadError || !order" class="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-base text-red-700" role="alert">
        Detail pesanan gagal dimuat atau tidak ditemukan.
        <button type="button" class="ml-1 font-semibold underline" @click="refresh()">Coba lagi</button>
      </div>

      <template v-else>
        <header class="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-[1.875rem] font-semibold leading-tight tracking-tight">{{ order.order_number }}</h1>
            <p class="mt-1 text-sm text-muted">{{ formatDate(order.created_at) }} · {{ order.buyer_name }}</p>
          </div>
          <span class="rounded-full px-3 py-1.5 text-sm font-semibold" :class="statusClass(order.status)">{{ statusMeta.label }}</span>
        </header>

        <div v-if="onHold" class="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p class="font-semibold">Pesanan ditahan karena laporan pembeli</p>
          <p class="mt-1">Admin sedang meninjau laporan ini. Tindakan seller ditunda hingga ada keputusan.</p>
          <p v-if="order.issue_note" class="mt-2 whitespace-pre-wrap">Laporan: {{ order.issue_note }}</p>
        </div>

        <div class="mt-6 space-y-4">
          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="buyer-title">
            <h2 id="buyer-title" class="text-lg font-semibold">Info Pembeli</h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt class="text-sm text-muted">Nama</dt><dd class="mt-1 text-base font-medium">{{ order.buyer_name }}</dd></div>
              <div><dt class="text-sm text-muted">Telepon</dt><dd class="mt-1 text-base font-medium"><a :href="`tel:${order.buyer_phone}`" class="hover:text-brand hover:underline">{{ order.buyer_phone }}</a></dd></div>
              <div><dt class="text-sm text-muted">Email</dt><dd class="mt-1 break-all text-base font-medium"><a :href="`mailto:${order.buyer_email}`" class="hover:text-brand hover:underline">{{ order.buyer_email }}</a></dd></div>
              <div class="sm:col-span-2"><dt class="text-sm text-muted">Alamat Pengiriman</dt><dd class="mt-1 whitespace-pre-wrap text-base font-medium">{{ order.shipping_address }}</dd></div>
            </dl>
          </section>

          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="payment-title">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 id="payment-title" class="text-lg font-semibold">Pembayaran &amp; Escrow</h2>
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="order.paid_at ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">{{ order.paid_at ? 'Pembayaran diterima' : 'Belum dibayar' }}</span>
            </div>
            <p v-if="order.status === 'awaiting_confirmation' && order.confirmation_deadline" class="mt-3 text-sm text-muted">Konfirmasi sebelum {{ formatDateTime(order.confirmation_deadline) }}.</p>
            <p v-if="order.status === 'awaiting_payment' && order.payment_deadline" class="mt-3 text-sm text-muted">Batas pembayaran: {{ formatDateTime(order.payment_deadline) }}. Pembeli menerima instruksi pembayaran setelah konfirmasi.</p>
            <p v-if="order.paid_at" class="mt-3 text-sm text-muted">Dibayar pada {{ formatDateTime(order.paid_at) }}. Dana mengikuti proses escrow hingga pesanan selesai.</p>
            <dl class="mt-4 space-y-2 border-t border-border pt-4 text-sm sm:text-base">
              <div class="flex justify-between gap-4"><dt class="text-muted">Subtotal item</dt><dd class="font-medium tabular-nums">{{ formatCurrency(order.subtotal_amount) }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted">Biaya platform ({{ formatPercent(order.platform_fee_rate_snapshot) }})</dt><dd class="font-medium tabular-nums">{{ formatCurrency(order.platform_fee_amount) }}</dd></div>
              <div v-if="order.channel_fee_amount" class="flex justify-between gap-4"><dt class="text-muted">Biaya kanal pembayaran</dt><dd class="font-medium tabular-nums">{{ formatCurrency(order.channel_fee_amount) }}</dd></div>
              <div class="flex justify-between gap-4 border-t border-border pt-3 font-semibold"><dt>Total dibayar pembeli</dt><dd class="tabular-nums">{{ formatCurrency(order.total_amount) }}</dd></div>
              <div v-if="order.status !== 'cancelled'" class="flex justify-between gap-4 text-brand"><dt class="font-semibold">{{ payout ? 'Pencairan seller' : 'Estimasi pencairan seller' }}</dt><dd class="font-semibold tabular-nums">{{ formatCurrency(payout?.payout_amount ?? sellerEstimate) }}</dd></div>
            </dl>
            <p v-if="order.status !== 'cancelled'" class="mt-3 text-sm text-muted">Pencairan menghitung item aktif setelah komisi seller {{ formatPercent(order.commission_rate_snapshot) }}.</p>
            <div v-if="order.status === 'completed'" class="mt-4 rounded-md bg-canvas p-3 text-sm">
              <p class="font-semibold">Status pencairan: {{ payoutLabel }}</p>
              <p v-if="payout?.status === 'failed' && payout.failure_reason" class="mt-1 text-red-700">{{ payout.failure_reason }}</p>
            </div>
            <div v-if="refunds.length" class="mt-4 border-t border-border pt-4">
              <h3 class="text-sm font-semibold">Pengembalian dana</h3>
              <p v-for="refund in refunds" :key="refund.id" class="mt-2 flex justify-between gap-3 text-sm text-muted">
                <span>{{ refund.refund_type === 'partial_item' ? 'Item dibatalkan' : 'Pesanan dibatalkan' }} · {{ refund.status === 'transferred' ? 'Sudah ditransfer' : 'Menunggu transfer admin' }}</span>
                <span class="shrink-0 tabular-nums">{{ formatCurrency(refund.total_refund_amount) }}</span>
              </p>
            </div>
          </section>

          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="items-title">
            <h2 id="items-title" class="text-lg font-semibold">Item Pesanan</h2>
            <div class="mt-4 divide-y divide-border">
              <article v-for="item in order.order_items" :key="item.id" class="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0">
                <div class="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-canvas">
                  <img v-if="item.snapshot_photo_url" :src="item.snapshot_photo_url" alt="" class="h-full w-full object-cover" loading="lazy">
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ item.product_name_snapshot }}</p>
                  <p v-if="item.variant_name_snapshot" class="mt-0.5 text-sm text-muted">{{ item.variant_name_snapshot }}</p>
                  <p class="mt-1 text-sm text-muted">{{ formatCurrency(item.unit_price) }} × {{ item.quantity }}</p>
                  <span v-if="item.item_status === 'cancelled'" class="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Item dibatalkan</span>
                </div>
                <div class="text-right">
                  <p class="font-semibold tabular-nums">{{ formatCurrency(item.line_total) }}</p>
                  <button v-if="actions.includes('cancel_item') && item.item_status === 'active'" type="button" class="mt-2 rounded-md border border-red-200 px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700" :disabled="working" @click="openCancelItem(item)">Batalkan item</button>
                </div>
              </article>
            </div>
          </section>

          <section v-if="order.status === 'processing' && !onHold" class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="shipping-form-title">
            <h2 id="shipping-form-title" class="text-lg font-semibold">Kirim Pesanan</h2>
            <p class="mt-1 text-sm text-muted">Isi nomor resi atau URL bukti pengiriman. Minimal salah satu wajib diisi.</p>
            <form class="mt-4 space-y-4" novalidate @submit.prevent="shipOrder">
              <div><label class="seller-form-label" for="tracking-number">Nomor Resi</label><input id="tracking-number" v-model="trackingNumber" class="seller-form-input" type="text" autocomplete="off" placeholder="Contoh: JNE1234567890"></div>
              <div><label class="seller-form-label" for="shipping-evidence">URL Bukti Pengiriman</label><input id="shipping-evidence" v-model="evidenceUrl" class="seller-form-input" type="url" inputmode="url" placeholder="https://..."></div>
              <p v-if="shippingError" class="text-sm text-red-700" role="alert">{{ shippingError }}</p>
              <button type="submit" class="min-h-11 rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50" :disabled="working">{{ working ? 'Menyimpan...' : 'Tandai Dikirim' }}</button>
            </form>
          </section>

          <section v-if="order.shipped_at" class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="shipping-title">
            <h2 id="shipping-title" class="text-lg font-semibold">Info Pengiriman</h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt class="text-sm text-muted">Dikirim pada</dt><dd class="mt-1 text-base font-medium">{{ formatDateTime(order.shipped_at) }}</dd></div>
              <div v-if="order.tracking_number"><dt class="text-sm text-muted">Nomor Resi</dt><dd class="mt-1 break-all text-base font-medium">{{ order.tracking_number }}</dd></div>
              <div v-if="safeEvidenceUrl" class="sm:col-span-2"><dt class="text-sm text-muted">Bukti Pengiriman</dt><dd class="mt-1"><a :href="safeEvidenceUrl" target="_blank" rel="noopener noreferrer" class="text-base font-medium text-brand underline">Lihat bukti pengiriman</a></dd></div>
            </dl>
          </section>

          <section class="rounded-lg border border-border bg-white p-5 sm:p-6" aria-labelledby="status-title">
            <h2 id="status-title" class="text-lg font-semibold">Status &amp; Tindakan</h2>
            <p class="mt-2 text-sm text-muted">{{ onHold ? 'Pesanan sedang ditinjau admin.' : confirmationExpired ? 'Batas konfirmasi telah berlalu. Pesanan menunggu pembatalan otomatis.' : statusMeta.description }}</p>
            <p v-if="order.status === 'delivered' && order.auto_complete_at && !onHold" class="mt-2 text-sm text-muted">Penyelesaian otomatis dijadwalkan pada {{ formatDateTime(order.auto_complete_at) }} jika pembeli tidak melaporkan masalah.</p>
            <p v-if="order.status === 'cancelled' && order.cancellation_reason" class="mt-2 text-sm text-red-700">Alasan: {{ order.cancellation_reason }}</p>
            <p v-else-if="order.status === 'cancelled' && order.cancelled_by === 'system'" class="mt-2 text-sm text-muted">Dibatalkan otomatis karena batas waktu konfirmasi atau pembayaran terlewati.</p>
            <p v-if="actionError" class="mt-3 text-sm text-red-700" role="alert">{{ actionError }}</p>
            <div v-if="actions.includes('confirm') || actions.includes('mark_delivered')" class="mt-4 flex flex-wrap gap-2">
              <button v-if="actions.includes('confirm')" type="button" class="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="working" @click="confirmOrder">{{ working ? 'Memproses...' : 'Konfirmasi Pesanan' }}</button>
              <button v-if="actions.includes('reject')" type="button" class="min-h-11 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700" :disabled="working" @click="openReject">Tolak Pesanan</button>
              <button v-if="actions.includes('mark_delivered')" type="button" class="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="working" @click="openMarkDelivered">Tandai Diterima</button>
            </div>
          </section>
        </div>
      </template>
    </div>

    <dialog ref="actionDialog" aria-labelledby="order-action-title" aria-describedby="order-action-description" class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-white p-0 text-ink shadow-xl backdrop:bg-black/35" @close="dialogMode = null; selectedItem = null">
      <form class="p-6" novalidate @submit.prevent="submitDialog">
        <h2 id="order-action-title" class="text-lg font-semibold">{{ dialogMode === 'reject' ? 'Tolak pesanan?' : dialogMode === 'cancel_item' ? 'Batalkan item?' : 'Tandai pesanan diterima?' }}</h2>
        <p id="order-action-description" class="mt-2 text-sm text-muted">{{ dialogMode === 'reject' ? 'Pembeli akan menerima alasan penolakan. Pesanan ini dibatalkan sebelum pembayaran.' : dialogMode === 'cancel_item' ? `Item ${selectedItem?.product_name_snapshot ?? ''} akan dibatalkan dan pengembalian dana diproses oleh admin.` : 'Pembeli akan menerima pemberitahuan. Pesanan dapat selesai otomatis setelah 3 hari jika tidak ada laporan masalah.' }}</p>
        <div v-if="dialogMode === 'reject'" class="mt-4">
          <label class="seller-form-label" for="reject-reason">Alasan Penolakan *</label>
          <textarea id="reject-reason" v-model="rejectReason" class="seller-form-input min-h-24 resize-y" placeholder="Jelaskan alasan penolakan kepada pembeli" autofocus />
          <p v-if="dialogError" class="mt-1 text-sm text-red-700" role="alert">{{ dialogError }}</p>
        </div>
        <p v-else-if="dialogError" class="mt-3 text-sm text-red-700" role="alert">{{ dialogError }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" :disabled="working" @click="actionDialog?.close()">Kembali</button>
          <button type="submit" class="min-h-11 rounded-md px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :class="dialogMode === 'mark_delivered' ? 'bg-brand hover:bg-brand-hover' : 'bg-red-700 hover:bg-red-800'" :disabled="working">{{ working ? 'Memproses...' : dialogMode === 'reject' ? 'Tolak Pesanan' : dialogMode === 'cancel_item' ? 'Batalkan Item' : 'Tandai Diterima' }}</button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { ORDER_STATUS, sellerOrderActions } from '~/utils/seller-order-status.mjs'

definePageMeta({ middleware: 'seller', layout: 'seller' })

type OrderItem = { id: string; product_name_snapshot: string; variant_name_snapshot: string | null; snapshot_photo_url: string | null; quantity: number; unit_price: number; line_total: number; item_status: string }
type Order = {
  id: string; order_number: string; status: string; created_at: string; buyer_name: string; buyer_phone: string; buyer_email: string; shipping_address: string;
  confirmation_deadline: string | null; payment_deadline: string | null; paid_at: string | null; shipped_at: string | null; delivered_at: string | null; auto_complete_at: string | null;
  cancellation_reason: string | null; cancelled_by: string | null; issue_reported_at: string | null; issue_resolved_at: string | null; issue_note: string | null;
  tracking_number: string | null; shipping_evidence_url: string | null; subtotal_amount: number; platform_fee_rate_snapshot: number; platform_fee_amount: number;
  commission_rate_snapshot: number; channel_fee_amount: number; total_amount: number; order_items: OrderItem[]
}
type Payout = { status: string; payout_amount: number; failure_reason: string | null }
type Refund = { id: string; refund_type: string; status: string; total_refund_amount: number }

const route = useRoute()
const orderId = String(route.params.id)
const { data, pending, error: loadError, refresh } = await useFetch(`/api/seller/orders/${orderId}`)
const order = computed(() => data.value?.order as Order | undefined)
const payout = computed(() => data.value?.payout as Payout | null)
const refunds = computed(() => (data.value?.refunds ?? []) as Refund[])
const onHold = computed(() => Boolean(order.value?.issue_reported_at && !order.value?.issue_resolved_at))
const confirmationExpired = computed(() => {
  const current = order.value
  return current?.status === 'awaiting_confirmation' && Boolean(current.confirmation_deadline && new Date(current.confirmation_deadline).getTime() <= Date.now())
})
const actions = computed(() => confirmationExpired.value ? [] : sellerOrderActions(order.value?.status, onHold.value))
const statusMeta = computed(() => ORDER_STATUS[order.value?.status as keyof typeof ORDER_STATUS] ?? { label: order.value?.status ?? '', description: 'Status pesanan belum tersedia.' })
const sellerEstimate = computed(() => {
  const activeSubtotal = order.value?.order_items.filter((item) => item.item_status === 'active').reduce((sum, item) => sum + item.line_total, 0) ?? 0
  return activeSubtotal - Math.round(activeSubtotal * (order.value?.commission_rate_snapshot ?? 0))
})
const payoutLabel = computed(() => ({ pending: 'Sedang diproses', succeeded: 'Berhasil dicairkan', failed: 'Gagal, menunggu tindak lanjut admin' }[payout.value?.status ?? ''] ?? 'Belum diproses'))
const safeEvidenceUrl = computed(() => {
  try {
    const url = new URL(order.value?.shipping_evidence_url ?? '')
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
})
const trackingNumber = ref('')
const evidenceUrl = ref('')
const shippingError = ref('')
const actionError = ref('')
const working = ref(false)
const actionDialog = ref<HTMLDialogElement | null>(null)
const dialogMode = ref<'reject' | 'cancel_item' | 'mark_delivered' | null>(null)
const selectedItem = ref<OrderItem | null>(null)
const rejectReason = ref('')
const dialogError = ref('')

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value))
const formatDateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const formatPercent = (value: number) => new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 2 }).format(value)
const statusClass = (status: string) => ({
  awaiting_confirmation: 'bg-amber-100 text-amber-800', awaiting_payment: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800', shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-sky-100 text-sky-800', completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}[status] ?? 'bg-gray-100 text-gray-800')

async function runAction(path: string, body?: Record<string, string>, target: 'main' | 'shipping' = 'main') {
  working.value = true
  actionError.value = ''
  dialogError.value = ''
  try {
    await $fetch(path, { method: 'POST', body })
    actionDialog.value?.close()
    await refresh()
  } catch (error) {
    console.error('Order action failed:', error)
    const statusCode = (error as { statusCode?: number }).statusCode
    const message = statusCode === 409 ? 'Status pesanan sudah berubah. Muat ulang lalu periksa kembali.' : 'Tindakan gagal. Periksa koneksi lalu coba lagi.'
    if (statusCode === 409) {
      actionDialog.value?.close()
      actionError.value = message
      await refresh()
    } else if (dialogMode.value) dialogError.value = message
    else if (target === 'shipping') shippingError.value = message
    else actionError.value = message
  } finally {
    working.value = false
  }
}

function confirmOrder() { return runAction(`/api/seller/orders/${orderId}/confirm`) }

function openMarkDelivered() {
  dialogMode.value = 'mark_delivered'
  dialogError.value = ''
  actionDialog.value?.showModal()
}

function openReject() {
  dialogMode.value = 'reject'
  rejectReason.value = ''
  dialogError.value = ''
  actionDialog.value?.showModal()
}

function openCancelItem(item: OrderItem) {
  selectedItem.value = item
  dialogMode.value = 'cancel_item'
  dialogError.value = ''
  actionDialog.value?.showModal()
}

async function submitDialog() {
  if (dialogMode.value === 'reject') {
    const reason = rejectReason.value.trim()
    if (!reason) { dialogError.value = 'Alasan penolakan wajib diisi.'; return }
    await runAction(`/api/seller/orders/${orderId}/reject`, { reason })
  } else if (dialogMode.value === 'cancel_item' && selectedItem.value) {
    await runAction(`/api/seller/order-items/${selectedItem.value.id}/cancel`)
  } else if (dialogMode.value === 'mark_delivered') {
    await runAction(`/api/seller/orders/${orderId}/mark-delivered`)
  }
}

async function shipOrder() {
  shippingError.value = ''
  const tracking_number = trackingNumber.value.trim()
  const shipping_evidence_url = evidenceUrl.value.trim()
  if (!tracking_number && !shipping_evidence_url) { shippingError.value = 'Isi nomor resi atau URL bukti pengiriman.'; return }
  if (shipping_evidence_url) {
    try {
      const url = new URL(shipping_evidence_url)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL')
    } catch { shippingError.value = 'Gunakan URL bukti pengiriman yang valid (https://...).'; return }
  }
  await runAction(`/api/seller/orders/${orderId}/ship`, { tracking_number, shipping_evidence_url }, 'shipping')
}
</script>
