<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Refund</h1>

      <AppTabs v-model="tab" :tabs="TABS" label="Filter refund" class="mb-6" />

      <p v-if="actionError" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{{ actionError }}</p>
      <p v-if="error" class="field-error" role="alert">Refund gagal dimuat.</p>
      <p v-else-if="pending" class="text-sm text-muted" role="status">Memuat refund...</p>
      <p v-else-if="!data?.refunds.length" class="text-sm text-muted">{{ tab === 'pending_transfer' ? 'Tidak ada refund yang menunggu transfer.' : 'Belum ada refund yang ditransfer.' }}</p>
      <div v-else class="space-y-3">
        <article v-for="refund in data.refunds" :key="refund.id" class="seller-card-padded flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold">{{ refund.orders.buyer_name }}</p>
            <p class="text-xs text-muted">
              <NuxtLink :to="`/admin/orders/${refund.order_id}`" class="hover:text-brand hover:underline">{{ refund.orders.order_number }}</NuxtLink>
              · {{ REFUND_TYPE[refund.refund_type] ?? refund.refund_type }} · {{ formatDateTime(refund.created_at) }}
            </p>
            <p class="mt-2 text-sm">
              <a :href="`mailto:${refund.orders.buyer_email}`" class="break-all hover:text-brand hover:underline">{{ refund.orders.buyer_email }}</a>
              · <a :href="`tel:${refund.orders.buyer_phone}`" class="hover:text-brand hover:underline">{{ refund.orders.buyer_phone }}</a>
            </p>
            <p v-if="refund.status === 'transferred'" class="mt-1 text-sm text-muted">Ref. {{ refund.transfer_reference }} · {{ formatDateTime(refund.transferred_at) }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-semibold tabular-nums">{{ formatCurrency(refund.total_refund_amount) }}</p>
            <button v-if="refund.status === 'pending_transfer'" type="button" class="mt-2 min-h-10 rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand" @click="openDialog(refund)">Tandai Ditransfer</button>
          </div>
        </article>
      </div>
    </section>

    <dialog ref="dialog" aria-labelledby="transfer-title" class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-white p-0 text-ink shadow-xl backdrop:bg-black/35">
      <form class="p-6" novalidate @submit.prevent="submit">
        <h2 id="transfer-title" class="text-lg font-semibold">Tandai refund ditransfer</h2>
        <p class="mt-2 text-sm text-muted">{{ selected?.orders.order_number }} · {{ selected && formatCurrency(selected.total_refund_amount) }}. Pembeli akan menerima email.</p>
        <label class="seller-form-label mt-4" for="transfer-reference">Referensi transfer Xendit <span class="text-red-600">*</span></label>
        <input id="transfer-reference" v-model="reference" class="seller-form-input" type="text" autocomplete="off">
        <p v-if="dialogError" class="mt-2 text-sm text-red-700" role="alert">{{ dialogError }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" :disabled="working" @click="dialog?.close()">Kembali</button>
          <button type="submit" class="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50" :disabled="working">{{ working ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </form>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import AppTabs from '~/components/ui/AppTabs.vue'
import { REFUND_TYPE, adminActionError, formatCurrency, formatDateTime } from '~/utils/admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Refund' })

const TABS = [{ value: 'pending_transfer', label: 'Menunggu Transfer' }, { value: 'transferred', label: 'Sudah Ditransfer' }]
const tab = ref('pending_transfer')

const { data, pending, error, refresh } = await useFetch<{ refunds: any[] }>('/api/admin/refunds', { query: computed(() => ({ status: tab.value })) })

const dialog = ref<HTMLDialogElement | null>(null)
const selected = ref<any>(null)
const reference = ref('')
const dialogError = ref('')
const actionError = ref('')
const working = ref(false)

function openDialog(refund: any) {
  selected.value = refund
  reference.value = ''
  dialogError.value = ''
  dialog.value?.showModal()
}

async function submit() {
  const transfer_reference = reference.value.trim()
  if (!transfer_reference) { dialogError.value = 'Referensi transfer wajib diisi.'; return }
  working.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/refunds/${selected.value.id}/mark-transferred`, { method: 'POST', body: { transfer_reference } })
    dialog.value?.close()
  } catch (err) {
    console.error('Mark refund transferred failed:', err)
    dialog.value?.close()
    actionError.value = adminActionError(err)
  } finally {
    working.value = false
    await refresh()
  }
}
</script>
