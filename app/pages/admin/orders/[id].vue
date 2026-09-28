<template>
  <section class="seller-page">
    <div class="seller-page-inner">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <AppPageTitle :title="order?.order_number ?? 'Detail Pesanan'" back-to="/admin/orders" back-label="Kembali ke Pesanan" />
        <span v-if="order" class="rounded-full px-3 py-1.5 text-sm font-semibold" :class="orderStatusBadge(order.status).class">{{ orderStatusBadge(order.status).label }}</span>
      </header>

      <div v-if="pending" class="mt-6 rounded-lg border border-border bg-white p-6 text-base text-muted" role="status">Memuat detail pesanan...</div>
      <div v-else-if="loadError || !order" class="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-base text-red-700" role="alert">
        Detail pesanan gagal dimuat atau tidak ditemukan.
        <button type="button" class="ml-1 font-semibold underline" @click="refresh()">Coba lagi</button>
      </div>

      <template v-else>
        <section v-if="order.issue_reported_at" class="mt-6 rounded-lg border p-5 sm:p-6" :class="onHold ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-border bg-white'" aria-labelledby="issue-title">
          <h2 id="issue-title" class="text-lg font-semibold">{{ onHold ? 'Laporan masalah — perlu keputusan' : 'Laporan masalah — selesai' }}</h2>
          <p class="mt-1 text-sm">Dilaporkan {{ formatDateTime(order.issue_reported_at) }}</p>
          <p class="mt-3 whitespace-pre-wrap text-base">{{ order.issue_note }}</p>
          <p v-if="!onHold" class="mt-3 text-sm font-medium">
            {{ order.issue_resolution === 'released' ? 'Dana dirilis ke seller' : 'Pesanan dibatalkan' }} pada {{ formatDateTime(order.issue_resolved_at) }}
          </p>
          <template v-if="onHold">
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50" :disabled="working || !canRelease" @click="openDialog('release')">Rilis Dana ke Seller</button>
              <button type="button" class="min-h-11 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-50" :disabled="working" @click="openDialog('cancel')">Batalkan &amp; Refund</button>
            </div>
            <p v-if="!canRelease" class="mt-2 text-sm">Rilis dana hanya bisa setelah pesanan dikirim.</p>
          </template>
        </section>

        <p v-if="actionError" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{{ actionError }}</p>

        <div class="mt-6 space-y-4">
          <section class="seller-card-padded" aria-labelledby="buyer-title">
            <h2 id="buyer-title" class="seller-section-title">Pembeli</h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt class="text-sm text-muted">Nama</dt><dd class="mt-1 font-medium">{{ order.buyer_name }}</dd></div>
              <div><dt class="text-sm text-muted">Telepon</dt><dd class="mt-1 font-medium"><a :href="`tel:${order.buyer_phone}`" class="hover:text-brand hover:underline">{{ order.buyer_phone }}</a></dd></div>
              <div><dt class="text-sm text-muted">Email</dt><dd class="mt-1 break-all font-medium"><a :href="`mailto:${order.buyer_email}`" class="hover:text-brand hover:underline">{{ order.buyer_email }}</a></dd></div>
              <div class="sm:col-span-2"><dt class="text-sm text-muted">Alamat Pengiriman</dt><dd class="mt-1 whitespace-pre-wrap font-medium">{{ order.shipping_address }}</dd></div>
            </dl>
          </section>

          <section class="seller-card-padded" aria-labelledby="items-title">
            <h2 id="items-title" class="seller-section-title">Item</h2>
            <div class="mt-4 divide-y divide-border">
              <article v-for="item in order.order_items" :key="item.id" class="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                <div class="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-canvas">
                  <img v-if="item.snapshot_photo_url" :src="item.snapshot_photo_url" alt="" class="h-full w-full object-cover" loading="lazy">
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ item.product_name_snapshot }}</p>
                  <p v-if="item.variant_name_snapshot" class="text-sm text-muted">{{ item.variant_name_snapshot }}</p>
                  <p class="text-sm text-muted">{{ formatCurrency(item.unit_price) }} × {{ item.quantity }}</p>
                  <span v-if="item.item_status === 'cancelled'" class="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Dibatalkan</span>
                </div>
                <p class="font-semibold tabular-nums">{{ formatCurrency(item.line_total) }}</p>
              </article>
            </div>
            <dl class="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div class="flex justify-between gap-4"><dt class="text-muted">Subtotal</dt><dd class="tabular-nums">{{ formatCurrency(order.subtotal_amount) }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-muted">Biaya platform</dt><dd class="tabular-nums">{{ formatCurrency(order.platform_fee_amount) }}</dd></div>
              <div v-if="order.channel_fee_amount" class="flex justify-between gap-4"><dt class="text-muted">Biaya kanal pembayaran</dt><dd class="tabular-nums">{{ formatCurrency(order.channel_fee_amount) }}</dd></div>
              <div class="flex justify-between gap-4 border-t border-border pt-2 font-semibold"><dt>Total</dt><dd class="tabular-nums">{{ formatCurrency(order.total_amount) }}</dd></div>
            </dl>
          </section>

          <section v-if="order.shipped_at" class="seller-card-padded" aria-labelledby="shipping-title">
            <h2 id="shipping-title" class="seller-section-title">Pengiriman</h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-3">
              <div><dt class="text-sm text-muted">Dikirim</dt><dd class="mt-1 font-medium">{{ formatDateTime(order.shipped_at) }}</dd></div>
              <div v-if="order.tracking_number"><dt class="text-sm text-muted">Nomor Resi</dt><dd class="mt-1 break-all font-medium">{{ order.tracking_number }}</dd></div>
              <div v-if="safeEvidenceUrl"><dt class="text-sm text-muted">Bukti</dt><dd class="mt-1"><a :href="safeEvidenceUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-brand underline">Lihat bukti pengiriman</a></dd></div>
              <div v-if="order.delivered_at"><dt class="text-sm text-muted">Diterima</dt><dd class="mt-1 font-medium">{{ formatDateTime(order.delivered_at) }}</dd></div>
            </dl>
          </section>

          <section class="seller-card-padded" aria-labelledby="money-title">
            <h2 id="money-title" class="seller-section-title">Pembayaran, Refund &amp; Payout</h2>

            <h3 class="mt-4 text-sm font-semibold">Pembayaran</h3>
            <p v-if="!order.payments.length" class="mt-1 text-sm text-muted">Belum ada pembayaran.</p>
            <p v-for="payment in order.payments" :key="payment.id" class="mt-1 flex justify-between gap-3 text-sm">
              <span>{{ payment.payment_method.toUpperCase() }} {{ payment.channel_code }} · {{ payment.status }}<template v-if="payment.paid_at"> · {{ formatDateTime(payment.paid_at) }}</template></span>
              <span class="shrink-0 tabular-nums">{{ formatCurrency(payment.amount) }}</span>
            </p>

            <h3 class="mt-4 text-sm font-semibold">Refund</h3>
            <p v-if="!order.refunds.length" class="mt-1 text-sm text-muted">Tidak ada refund.</p>
            <p v-for="refund in order.refunds" :key="refund.id" class="mt-1 flex justify-between gap-3 text-sm">
              <span>{{ REFUND_TYPE[refund.refund_type] ?? refund.refund_type }} · {{ refund.status === 'transferred' ? `Ditransfer (${refund.transfer_reference})` : 'Menunggu transfer' }}</span>
              <span class="shrink-0 tabular-nums">{{ formatCurrency(refund.total_refund_amount) }}</span>
            </p>

            <h3 class="mt-4 text-sm font-semibold">Payout</h3>
            <p v-if="!payout" class="mt-1 text-sm text-muted">Belum ada payout.</p>
            <template v-else>
              <p class="mt-1 flex justify-between gap-3 text-sm">
                <span>{{ payout.bank_code }} {{ payout.account_number }} a.n. {{ payout.account_holder_name }} · {{ payout.status }} · percobaan {{ payout.attempt }}</span>
                <span class="shrink-0 tabular-nums">{{ formatCurrency(payout.payout_amount) }}</span>
              </p>
              <p v-if="payout.failure_reason" class="mt-1 text-sm text-red-700">{{ payout.failure_reason }}</p>
            </template>
          </section>
        </div>
      </template>
    </div>

    <dialog ref="dialog" aria-labelledby="admin-action-title" class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-white p-0 text-ink shadow-xl backdrop:bg-black/35" @close="dialogMode = null">
      <form class="p-6" novalidate @submit.prevent="submitDialog">
        <h2 id="admin-action-title" class="text-lg font-semibold">{{ dialogMode === 'release' ? 'Rilis dana ke seller?' : 'Batalkan pesanan?' }}</h2>
        <p v-if="dialogMode === 'release'" class="mt-2 text-sm text-muted">Pesanan menjadi selesai dan payout ke seller dibuat. Tindakan ini tidak bisa dibatalkan.</p>
        <template v-else-if="order">
          <p class="mt-2 text-sm text-muted">Refund yang akan dicatat untuk pembeli:</p>
          <dl class="mt-3 space-y-1 rounded-md bg-canvas p-3 text-sm">
            <div class="flex justify-between gap-4"><dt>Item aktif</dt><dd class="tabular-nums">{{ formatCurrency(refundPreview.item_amount_refunded) }}</dd></div>
            <div class="flex justify-between gap-4"><dt>Biaya platform</dt><dd class="tabular-nums">{{ formatCurrency(refundPreview.platform_fee_refunded) }}</dd></div>
            <div class="flex justify-between gap-4 font-semibold"><dt>Total refund</dt><dd class="tabular-nums">{{ formatCurrency(refundPreview.total_refund_amount) }}</dd></div>
          </dl>
          <label class="seller-form-label mt-4" for="cancel-reason">Alasan <span class="text-red-600">*</span></label>
          <textarea id="cancel-reason" v-model="cancelReason" class="seller-form-input min-h-24 resize-y" />
        </template>
        <p v-if="dialogError" class="mt-3 text-sm text-red-700" role="alert">{{ dialogError }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" :disabled="working" @click="dialog?.close()">Kembali</button>
          <button type="submit" class="min-h-11 rounded-md px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :class="dialogMode === 'release' ? 'bg-brand hover:bg-brand-hover' : 'bg-red-700 hover:bg-red-800'" :disabled="working">
            {{ working ? 'Memproses...' : dialogMode === 'release' ? 'Rilis Dana' : 'Batalkan & Refund' }}
          </button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import { adminCancelRefund } from '#shared/utils/refund-amount.mjs'
import { REFUND_TYPE, adminActionError, formatCurrency, formatDateTime, orderStatusBadge } from '~/utils/admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })


const orderId = String(useRoute().params.id)
const { data, pending, error: loadError, refresh } = await useFetch<{ order: any }>(`/api/admin/orders/${orderId}`)
const order = computed(() => data.value?.order)
useHead({ title: () => order.value?.order_number ?? 'Detail Pesanan' })

const onHold = computed(() => Boolean(order.value?.issue_reported_at && !order.value?.issue_resolved_at))
const canRelease = computed(() => ['shipped', 'delivered'].includes(order.value?.status))
// One payout per order (unique order_id); PostgREST may embed it as an object or a one-row array.
const payout = computed(() => {
  const value = order.value?.payouts
  return Array.isArray(value) ? value[0] : value
})
const refundPreview = computed(() => adminCancelRefund(order.value))
const safeEvidenceUrl = computed(() => {
  try {
    const url = new URL(order.value?.shipping_evidence_url ?? '')
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
})

const dialog = ref<HTMLDialogElement | null>(null)
const dialogMode = ref<'release' | 'cancel' | null>(null)
const cancelReason = ref('')
const dialogError = ref('')
const actionError = ref('')
const working = ref(false)

function openDialog(mode: 'release' | 'cancel') {
  dialogMode.value = mode
  cancelReason.value = ''
  dialogError.value = ''
  dialog.value?.showModal()
}

async function submitDialog() {
  const reason = cancelReason.value.trim()
  if (dialogMode.value === 'cancel' && !reason) { dialogError.value = 'Alasan wajib diisi.'; return }

  working.value = true
  dialogError.value = ''
  actionError.value = ''
  try {
    await $fetch(`/api/admin/orders/${orderId}/${dialogMode.value}`, { method: 'POST', body: dialogMode.value === 'cancel' ? { reason } : undefined })
    dialog.value?.close()
  } catch (error) {
    console.error('Admin order action failed:', error)
    dialog.value?.close()
    actionError.value = adminActionError(error)
  } finally {
    working.value = false
    await refresh()
  }
}
</script>
