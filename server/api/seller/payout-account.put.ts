import { readBody } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { upsertPayoutAccount } from '../../repositories/payout-account.repository'

const REQUIRED_KEYS = ['bank_code', 'account_number', 'account_holder_name'] as const
const ALLOWED_KEYS = new Set(REQUIRED_KEYS)
const SUPPORTED_BANK_CODES = new Set(['BCA'])

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key as typeof REQUIRED_KEYS[number])) {
      throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof body[key] !== 'string' || body[key].length === 0) {
      throw apiError(400, 'INVALID_INPUT', `${key} must be a non-empty string`)
    }
  }

  if (!SUPPORTED_BANK_CODES.has(body.bank_code)) {
    throw apiError(400, 'INVALID_INPUT', 'Saat ini payout hanya mendukung rekening BCA.')
  }

  const { data, error } = await upsertPayoutAccount(event, seller.id, {
    bank_code: body.bank_code,
    account_number: body.account_number,
    account_holder_name: body.account_holder_name
  })

  if (error || !data) {
    console.error('upsertPayoutAccount failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to save payout account')
  }

  return { payoutAccount: data }
})
