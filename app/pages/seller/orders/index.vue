<template>
  <main class="seller-page">
    <section class="seller-page-inner max-w-5xl">
      <h1 class="seller-page-title mb-6">Pesanan</h1>

      <div class="mb-4">
        <label class="field-label" for="trip-filter">Trip</label>
        <select id="trip-filter" v-model="tripId" class="field-input mt-1 max-w-xs">
          <option value="">Semua Trip</option>
          <option v-for="trip in trips?.trips ?? []" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
        </select>
      </div>

      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          type="button"
          class="rounded-full px-4 py-1.5 text-sm font-medium"
          :class="status === tab.value ? 'bg-brand text-white' : 'border border-border bg-white text-ink hover:border-brand/40'"
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <p v-if="errorMessage" class="field-error">{{ errorMessage }}</p>
      <div v-else-if="pending" class="text-sm text-muted">Memuat pesanan...</div>
      <p v-else-if="!orders?.orders?.length" class="text-sm text-muted">Belum ada pesanan.</p>
      <div v-else class="space-y-3">
        <NuxtLink v-for="order in orders.orders" :key="order.id" :to="`/seller/orders/${order.id}`" class="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <div>
            <p class="font-semibold text-ink">{{ order.buyer_name }}</p>
            <p class="text-xs text-muted">{{ order.order_number }} · {{ formatDate(order.created_at) }}</p>
            <p class="mt-1 text-xs text-muted">{{ itemSummary(order) }}</p>
          </div>
          <div class="text-right">
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusMeta(order.status).class">{{ statusMeta(order.status).label }}</span>
            <p class="mt-2 text-sm font-semibold">{{ formatCurrency(order.total_amount) }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ORDER_STATUS } from '~/utils/seller-order-status.mjs'

definePageMeta({ middleware: 'seller', layout: 'seller' })

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  ...Object.entries(ORDER_STATUS).map(([value, meta]) => ({ value, label: meta.label }))
]

const STATUS_CLASS: Record<string, string> = {
  awaiting_confirmation: 'bg-amber-100 text-amber-800',
  awaiting_payment: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-sky-100 text-sky-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

function statusMeta(status: string) {
  return { label: ORDER_STATUS[status as keyof typeof ORDER_STATUS]?.label ?? status, class: STATUS_CLASS[status] ?? 'bg-gray-100 text-gray-800' }
}

const tripId = ref('')
const status = ref('')

const { data: trips } = await useFetch('/api/seller/trips')
const { data: orders, pending, error } = await useFetch('/api/seller/orders', {
  query: computed(() => ({ trip_id: tripId.value || undefined, status: status.value || undefined }))
})
const errorMessage = computed(() => error.value ? 'Pesanan gagal dimuat.' : '')

function itemSummary(order: any) {
  const items = order.order_items ?? []
  const names = items.map((item: any) => item.product_name_snapshot).join(', ')
  return `${items.length} item · ${names}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}
</script>
