import { getQuery } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireAdmin } from '../../utils/require-admin'
import { getSupabaseAdmin } from '../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const status = getQuery(event).status
  let query = getSupabaseAdmin(event).from('refunds')
    .select('*,orders(order_number,buyer_name,buyer_email,buyer_phone)')
    .order('created_at', { ascending: false })
  if (typeof status === 'string' && status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load refunds')
  return { refunds: data ?? [] }
})
