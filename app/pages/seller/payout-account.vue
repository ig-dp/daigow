<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Akun Payout" back-to="/seller/dashboard" back-label="Kembali" class="mb-6" />
      <section class="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Rekening</h2>
        <p class="mt-3 text-sm text-muted">Rekening ini digunakan untuk menerima payout setelah pesanan selesai.</p>
        <form class="mt-5 space-y-4" @submit.prevent="save">
          <div>
            <label class="field-label" for="bank-code">Bank *</label>
            <select id="bank-code" v-model="form.bank_code" class="field-input" :aria-invalid="Boolean(fieldErrors.bank_code)">
              <option value="">Pilih bank</option>
              <option v-for="bank in BANKS" :key="bank.value" :value="bank.value">{{ bank.label }}</option>
            </select>
            <p v-if="fieldErrors.bank_code" class="field-error">{{ fieldErrors.bank_code }}</p>
          </div>
          <AppTextField v-model="form.account_number" id="account-number" name="account_number" label="Nomor Rekening *" inputmode="numeric" :error="fieldErrors.account_number" />
          <AppTextField v-model="form.account_holder_name" id="account-holder" name="account_holder_name" label="Nama Pemilik Rekening *" autocomplete="name" :error="fieldErrors.account_holder_name" />
          <p v-if="message" class="text-sm" :class="saved ? 'text-brand' : 'text-red-700'" role="status">{{ message }}</p>
          <AppButton type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan Rekening' }}</AppButton>
        </form>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import AppTextField from '~/components/ui/AppTextField.vue'

definePageMeta({ middleware: 'seller', layout: 'seller' })
useHead({ title: 'Akun Payout' })

// Keep this list aligned with shared/utils/payout.mjs until each channel has
// been verified in Xendit's Payouts v3 Dynamic Schema.
const BANKS = [{ value: 'BCA', label: 'BCA (Payouts v3)' }]
const form = reactive({ bank_code: '', account_number: '', account_holder_name: '' })
const fieldErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const saved = ref(false)
const message = ref('')

const { data } = await useFetch('/api/seller/payout-account', { default: () => ({ payoutAccount: null }) })
if (data.value?.payoutAccount) {
  const payoutAccount = data.value.payoutAccount
  Object.assign(form, {
    bank_code: payoutAccount.bank_code ?? '',
    account_number: payoutAccount.account_number ?? '',
    account_holder_name: payoutAccount.account_holder_name ?? ''
  })
}

async function save() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  message.value = ''
  saved.value = false
  if (!form.bank_code) fieldErrors.bank_code = 'Pilih bank.'
  if (!form.account_number.trim()) fieldErrors.account_number = 'Nomor rekening wajib diisi.'
  if (!form.account_holder_name.trim()) fieldErrors.account_holder_name = 'Nama pemilik wajib diisi.'
  if (Object.keys(fieldErrors).length) return
  saving.value = true
  try {
    await $fetch('/api/seller/payout-account', {
      method: 'PUT',
      body: {
        bank_code: form.bank_code,
        account_number: form.account_number,
        account_holder_name: form.account_holder_name
      }
    })
    saved.value = true
    message.value = 'Informasi rekening berhasil disimpan.'
  } catch {
    message.value = 'Informasi rekening gagal disimpan. Coba lagi.'
  } finally { saving.value = false }
}
</script>
