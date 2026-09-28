import { apiError } from '../../../utils/api-error'
import { requireAdmin } from '../../../utils/require-admin'
import { getSupabaseAdmin } from '../../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { data, error } = await getSupabaseAdmin(event)
    .from('payments')
    .select('*,orders!inner(id,order_number,status,buyer_name,buyer_email,buyer_phone)')
    .order('created_at', { ascending: false })
    .eq('status', 'paid')
    .not('orders.status', 'in', '(processing,shipped,delivered,completed)')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orphaned payments')
  return { payments: data ?? [] }
})
