import { apiError } from '../../../../utils/api-error'
import { requireAdmin } from '../../../../utils/require-admin'
import { retryPayout } from '../../../../repositories/payout.repository'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  try {
    const { data, error } = await retryPayout(event, getRouterParam(event, 'id')!)
    if (error || !data) throw new Error(error?.message ?? 'update failed')
    return { payout: data }
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) throw apiError(404, 'PAYOUT_NOT_FOUND', 'Payout not found')
    if (message.includes('not failed')) throw apiError(409, 'INVALID_STATE', 'Payout is not failed')
    console.error('retry payout failed:', message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to retry payout')
  }
})
