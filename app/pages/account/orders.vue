<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Pesanan Saya</h1>

      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          type="button"
          class="rounded-full px-4 py-1.5 text-sm font-medium"
          :class="status === tab.value ? 'bg-brand text-white' : 'border border-border bg-white text-ink hover:border-brand/40'"
          :aria-pressed="status === tab.value"
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <p v-if="error" class="field-error" role="alert">Pesanan gagal dimuat.</p>
      <p v-else-if="pending" class="text-sm text-muted" role="status">Memuat pesanan...</p>
      <p v-else-if="!visibleOrders.length" class="text-sm text-muted">Belum ada pesanan.</p>
      <div v-else class="space-y-3">
        <NuxtLink v-for="order in visibleOrders" :key="order.id" :to="`/orders/track/${order.tracking_token}`" class="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <div class="min-w-0">
            <p class="font-semibold text-ink">{{ order.order_number }}</p>
            <p class="text-xs text-muted">{{ formatDate(order.created_at) }}</p>
            <p class="mt-1 truncate text-xs text-muted">{{ itemSummary(order) }}</p>
          </div>
          <div class="shrink-0 text-right">
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusMeta(order.status).class">{{ statusMeta(order.status).label }}</span>
            <p class="mt-2 text-sm font-semibold">{{ formatCurrency(order.total_amount) }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ORDER_STATUS, ORDER_STATUS_CLASS } from '~/utils/seller-order-status.mjs'

definePageMeta({ middleware: 'auth', layout: 'account' })
useHead({ title: 'Pesanan Saya' })

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  ...Object.entries(ORDER_STATUS).map(([value, meta]) => ({ value, label: meta.label }))
]

const status = ref('')
const { data, pending, error } = await useFetch('/api/me/orders')
// ponytail: filtered client-side; add a status query to /api/me/orders if buyers get many orders
const visibleOrders = computed(() => (data.value?.orders ?? []).filter((order: any) => !status.value || order.status === status.value))

function statusMeta(value: string) {
  return { label: ORDER_STATUS[value as keyof typeof ORDER_STATUS]?.label ?? value, class: ORDER_STATUS_CLASS[value as keyof typeof ORDER_STATUS_CLASS] ?? 'bg-gray-100 text-gray-800' }
}

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
