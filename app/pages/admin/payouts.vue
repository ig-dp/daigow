<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Payout</h1>

      <AppTabs v-model="tab" :tabs="TABS" label="Filter payout" class="mb-6" />

      <p v-if="actionError" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{{ actionError }}</p>
      <p v-if="error" class="field-error" role="alert">Payout gagal dimuat.</p>
      <p v-else-if="pending" class="text-sm text-muted" role="status">Memuat payout...</p>
      <p v-else-if="!data?.payouts.length" class="text-sm text-muted">{{ tab === 'failed' ? 'Tidak ada payout yang gagal.' : 'Belum ada payout.' }}</p>
      <div v-else class="space-y-3">
        <article v-for="payout in data.payouts" :key="payout.id" class="seller-card-padded flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold">{{ payout.account_holder_name }}</p>
            <p class="text-xs text-muted">
              <NuxtLink :to="`/admin/orders/${payout.order_id}`" class="hover:text-brand hover:underline">{{ payout.orders?.order_number }}</NuxtLink>
              · {{ payout.bank_code }} {{ payout.account_number }} · percobaan {{ payout.attempt }} · {{ formatDateTime(payout.requested_at) }}
            </p>
            <p v-if="payout.failure_reason" class="mt-2 text-sm text-red-700">{{ payout.failure_reason }}</p>
          </div>
          <div class="text-right">
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="STATUS[payout.status]?.class ?? 'bg-gray-100 text-gray-800'">{{ STATUS[payout.status]?.label ?? payout.status }}</span>
            <p class="mt-2 text-lg font-semibold tabular-nums">{{ formatCurrency(payout.payout_amount) }}</p>
            <button v-if="payout.status === 'failed'" type="button" class="mt-2 min-h-10 rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="retrying === payout.id" @click="retry(payout.id)">
              {{ retrying === payout.id ? 'Memproses...' : 'Coba Lagi' }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppTabs from '~/components/ui/AppTabs.vue'
import { adminActionError, formatCurrency, formatDateTime } from '~/utils/admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Payout' })

const TABS = [{ value: 'failed', label: 'Gagal' }, { value: 'all', label: 'Semua' }]
const STATUS: Record<string, { label: string, class: string }> = {
  pending: { label: 'Diproses', class: 'bg-amber-100 text-amber-800' },
  succeeded: { label: 'Berhasil', class: 'bg-green-100 text-green-800' },
  failed: { label: 'Gagal', class: 'bg-red-100 text-red-800' }
}
const tab = ref('failed')

const { data, pending, error, refresh } = await useFetch<{ payouts: any[] }>('/api/admin/payouts', {
  query: computed(() => ({ status: tab.value === 'failed' ? 'failed' : undefined }))
})

const retrying = ref<string | null>(null)
const actionError = ref('')

// Retry re-reads the seller's current payout account, so ask them to fix it first.
async function retry(id: string) {
  retrying.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/admin/payouts/${id}/retry`, { method: 'POST' })
  } catch (err) {
    console.error('Retry payout failed:', err)
    actionError.value = adminActionError(err)
  } finally {
    retrying.value = null
    await refresh()
  }
}
</script>
