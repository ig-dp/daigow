import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { getSellerDashboard } from '../../repositories/seller-dashboard.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const { data, error } = await getSellerDashboard(event, seller.id)

  if (error) {
    console.error('getSellerDashboard failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load dashboard')
  }

  return data
})
