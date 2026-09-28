// Keep channel metadata in one place so adding another supported bank only
// requires a new entry, rather than changing the payout request builder.
export const PAYOUT_CHANNELS = Object.freeze({
  BCA: Object.freeze({ routing_type_1: 'SWIFT', routing_value_1: 'CENAIDJA' })
})

function splitName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return { given_name: parts[0] ?? '', surname: parts.slice(1).join(' ') || parts[0] || '' }
}

export function buildPayoutRequest({ externalId, amount, account, description, email }) {
  const channel = PAYOUT_CHANNELS[String(account.bank_code ?? '').toUpperCase()]
  if (!channel) throw new Error(`Unsupported payout channel: ${account.bank_code}`)
  const name = splitName(account.account_holder_name)
  const address = { country: account.account_country ?? 'ID' }
  const recipient = {
    type: 'INDIVIDUAL',
    ...name,
    relationship: 'SUPPLIER',
    ...(email ? { details: { personal_email: email } } : {}),
    address,
    account_details: {
      currency: account.currency ?? 'IDR',
      account_country: account.account_country ?? 'ID',
      account_holder_name: account.account_holder_name,
      account_number: account.account_number,
      ...channel
    }
  }
  return {
    reference_id: externalId,
    recipient,
    payout_details: {
      source_currency: 'IDR',
      source_amount: amount,
      destination_currency: account.currency ?? 'IDR'
    },
    source_of_fund: 'BUSINESS_REVENUE',
    purpose_code: 'TRADES',
    description
  }
}

export function normalizePayoutStatus(status) {
  const value = String(status ?? '').toUpperCase()
  if (['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'PAID'].includes(value)) return 'succeeded'
  if (['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'REVERSED'].includes(value)) return 'failed'
  return 'pending'
}
