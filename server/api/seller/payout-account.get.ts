import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { getPayoutAccount } from '../../repositories/payout-account.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const { data, error } = await getPayoutAccount(event, seller.id)

  if (error?.code === 'PGRST116') throw apiError(404, 'PAYOUT_ACCOUNT_NOT_FOUND', 'Payout account not found')
  if (error) {
    console.error('getPayoutAccount failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load payout account')
  }
  if (!data) throw apiError(404, 'PAYOUT_ACCOUNT_NOT_FOUND', 'Payout account not found')

  return { payoutAccount: data }
})
