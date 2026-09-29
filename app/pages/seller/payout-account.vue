<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Akun Payout" back-to="/seller/dashboard" back-label="Kembali" class="mb-6" />
      <section class="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 class="border-b border-border pb-4 text-sm font-semibold">Informasi Rekening</h2>
        <p class="mt-3 text-sm text-muted">Rekening dan alamat ini digunakan untuk menerima payout setelah pesanan selesai.</p>
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
          <AppTextField v-model="form.street_line_1" id="street-line-1" name="street_line_1" label="Alamat Jalan *" autocomplete="street-address" :error="fieldErrors.street_line_1" placeholder="Jl. Contoh No. 10" />
          <AppTextField v-model="form.city" id="city" name="city" label="Kota *" autocomplete="address-level2" :error="fieldErrors.city" placeholder="Makassar" />
          <div class="grid gap-4 sm:grid-cols-2">
            <AppTextField v-model="form.province_state" id="province-state" name="province_state" label="Provinsi" autocomplete="address-level1" />
            <AppTextField v-model="form.postal_code" id="postal-code" name="postal_code" label="Kode Pos" autocomplete="postal-code" inputmode="numeric" />
          </div>
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
const form = reactive({ bank_code: '', account_number: '', account_holder_name: '', city: '', street_line_1: '', province_state: '', postal_code: '' })
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
    account_holder_name: payoutAccount.account_holder_name ?? '',
    city: payoutAccount.city ?? '',
    street_line_1: payoutAccount.street_line_1 ?? '',
    province_state: payoutAccount.province_state ?? '',
    postal_code: payoutAccount.postal_code ?? ''
  })
}

async function save() {
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  message.value = ''
  saved.value = false
  if (!form.bank_code) fieldErrors.bank_code = 'Pilih bank.'
  if (!form.account_number.trim()) fieldErrors.account_number = 'Nomor rekening wajib diisi.'
  if (!form.account_holder_name.trim()) fieldErrors.account_holder_name = 'Nama pemilik wajib diisi.'
  if (!form.street_line_1.trim()) fieldErrors.street_line_1 = 'Alamat jalan wajib diisi untuk payout.'
  if (!form.city.trim()) fieldErrors.city = 'Kota wajib diisi untuk payout.'
  if (Object.keys(fieldErrors).length) return
  saving.value = true
  try {
    await $fetch('/api/seller/payout-account', {
      method: 'PUT',
      body: {
        bank_code: form.bank_code,
        account_number: form.account_number,
        account_holder_name: form.account_holder_name,
        city: form.city,
        street_line_1: form.street_line_1,
        province_state: form.province_state || null,
        postal_code: form.postal_code || null
      }
    })
    saved.value = true
    message.value = 'Informasi rekening berhasil disimpan.'
  } catch {
    message.value = 'Informasi rekening gagal disimpan. Coba lagi.'
  } finally { saving.value = false }
}
</script>
