<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Pembayaran Terlambat</h1>

      <p v-if="error" class="field-error" role="alert">Data pembayaran gagal dimuat.</p>
      <p v-else-if="pending" class="text-sm text-muted" role="status">Memuat pembayaran...</p>
      <p v-else-if="!data?.payments.length" class="text-sm text-muted">Tidak ada pembayaran yang perlu direfund manual.</p>
      <div v-else class="space-y-3">
        <article v-for="payment in data.payments" :key="payment.id" class="seller-card-padded flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold">{{ payment.orders.buyer_name }}</p>
            <p class="text-xs text-muted">
              <NuxtLink :to="`/admin/orders/${payment.order_id}`" class="hover:text-brand hover:underline">{{ payment.orders.order_number }}</NuxtLink>
              · {{ payment.payment_method.toUpperCase() }} {{ payment.channel_code }} · dibayar {{ payment.paid_at ? formatDateTime(payment.paid_at) : '-' }}
            </p>
            <p class="mt-2 text-sm">
              <a :href="`mailto:${payment.orders.buyer_email}`" class="break-all hover:text-brand hover:underline">{{ payment.orders.buyer_email }}</a>
              · <a :href="`tel:${payment.orders.buyer_phone}`" class="hover:text-brand hover:underline">{{ payment.orders.buyer_phone }}</a>
            </p>
          </div>
          <div class="text-right">
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="orderStatusBadge(payment.orders.status).class">Pesanan {{ orderStatusBadge(payment.orders.status).label.toLowerCase() }}</span>
            <p class="mt-2 text-lg font-semibold tabular-nums">{{ formatCurrency(payment.amount) }}</p>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { formatCurrency, formatDateTime, orderStatusBadge } from '~/utils/admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Pembayaran Terlambat' })

const { data, pending, error } = await useFetch<{ payments: any[] }>('/api/admin/payments/orphaned')
</script>
