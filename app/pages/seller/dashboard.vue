<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <header class="seller-page-header">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-muted">Seller Dashboard</p>
          <h1 class="seller-page-title mt-1">Dashboard</h1>
        </div>
        <div class="flex items-center gap-4">
          <button class="btn-primary !w-auto" type="button" @click="navigateTo('/seller/trips/new')">+ Buat Trip Baru</button>
        </div>
      </header>

      <p v-if="errorMessage" class="field-error mb-4">{{ errorMessage }}</p>
      <div v-else-if="pending" class="text-sm text-muted">Memuat dashboard...</div>
      <template v-else>
        <div class="grid gap-4 md:grid-cols-4">
          <article v-for="stat in stats" :key="stat.label" class="seller-card-padded">
            <p class="text-sm text-muted">{{ stat.label }}</p>
            <p class="mt-2 text-2xl font-semibold text-ink">{{ stat.value }}</p>
            <p class="mt-1 text-xs text-muted">{{ stat.caption }}</p>
          </article>
        </div>

        <h2 class="mb-4 mt-9 text-sm font-semibold uppercase tracking-wide text-muted">Trip Saya</h2>
        <div class="space-y-3">
          <NuxtLink v-for="trip in dashboard?.trips ?? []" :key="trip.id" :to="`/seller/trips/${trip.id}`" class="flex overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-colors hover:border-brand/40">
            <img :src="trip.thumbnail_url" :alt="trip.title" class="hidden h-32 w-64 object-cover sm:block">
            <div class="flex-1 p-5">
              <div class="flex items-start justify-between gap-4">
                <h3 class="font-semibold text-ink">{{ trip.title }}</h3>
                <span class="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">{{ trip.status }}</span>
              </div>
              <p class="mt-2 text-sm text-muted">{{ trip.destination }}</p>
              <p class="mt-3 text-xs text-muted">{{ formatDate(trip.order_open_at) }} – {{ formatDate(trip.order_close_at) }}</p>
              <p class="mt-2 text-xs text-muted">{{ trip.product_count }} produk · {{ trip.order_count }} pesanan</p>
            </div>
            <div class="flex items-center border-l border-border px-4 text-muted">›</div>
          </NuxtLink>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'seller', layout: 'seller' })

const { data: dashboard, pending, error } = await useFetch('/api/seller/dashboard')
const errorMessage = computed(() => error.value ? 'Dashboard gagal dimuat.' : '')
const stats = computed(() => [
  { label: 'Total Trip', value: dashboard.value?.stats.total_trips ?? 0, caption: 'semua waktu' },
  { label: 'Trip Aktif', value: dashboard.value?.stats.active_trips ?? 0, caption: 'sedang berjalan' },
  { label: 'Pesanan Aktif', value: dashboard.value?.stats.active_orders ?? 0, caption: 'perlu ditangani' },
  { label: 'Revenue Selesai', value: formatCurrency(dashboard.value?.stats.completed_revenue ?? 0), caption: 'dari trip selesai' }
])

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}
</script>
