<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Pesanan</h1>

      <AppTabs v-model="tab" :tabs="TABS" label="Filter pesanan" class="mb-6" />

      <p v-if="error" class="field-error" role="alert">Pesanan gagal dimuat.</p>
      <p v-else-if="pending" class="text-sm text-muted" role="status">Memuat pesanan...</p>
      <p v-else-if="!data?.orders.length" class="text-sm text-muted">{{ tab === 'hold' ? 'Tidak ada pesanan yang ditahan.' : 'Belum ada pesanan.' }}</p>
      <div v-else class="space-y-3">
        <NuxtLink
          v-for="order in data.orders"
          :key="order.id"
          :to="`/admin/orders/${order.id}`"
          class="flex items-start justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <div class="min-w-0">
            <p class="font-semibold text-ink">{{ order.buyer_name }}</p>
            <p class="text-xs text-muted">{{ order.order_number }} · {{ formatDateTime(order.created_at) }}</p>
            <p v-if="isOnHold(order)" class="mt-2 line-clamp-2 text-sm text-amber-900">
              Dilaporkan {{ formatDateTime(order.issue_reported_at) }}: {{ order.issue_note }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <div class="flex flex-wrap justify-end gap-1">
              <span v-if="isOnHold(order)" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Ditahan</span>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="orderStatusBadge(order.status).class">{{ orderStatusBadge(order.status).label }}</span>
            </div>
            <p class="mt-2 text-sm font-semibold tabular-nums">{{ formatCurrency(order.total_amount) }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppTabs from '~/components/ui/AppTabs.vue'
import { formatCurrency, formatDateTime, orderStatusBadge } from '~/utils/admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Pesanan' })

const TABS = [{ value: 'hold', label: 'Ditahan' }, { value: 'all', label: 'Semua' }]
const tab = ref('hold')

const { data, pending, error } = await useFetch<{ orders: any[] }>('/api/admin/orders', {
  query: computed(() => ({ on_hold: tab.value === 'hold' ? 'true' : undefined }))
})

const isOnHold = (order: any) => Boolean(order.issue_reported_at && !order.issue_resolved_at)
</script>
