import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireAdmin } from '../../../../utils/require-admin'
import { sendEmail } from '../../../../utils/mailer'
import { getSupabaseAdmin } from '../../../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body.transfer_reference !== 'string' || !body.transfer_reference.trim()) throw apiError(400, 'INVALID_INPUT', 'transfer_reference must be a non-empty string')
  const refundId = getRouterParam(event, 'id')!
  const db = getSupabaseAdmin(event)

  // Conditional: only a pending refund flips, so a second click gets 0 rows.
  const { data, error } = await db.from('refunds')
    .update({ status: 'transferred', transfer_reference: body.transfer_reference.trim(), transferred_at: new Date().toISOString(), transferred_by: admin.id })
    .eq('id', refundId).eq('status', 'pending_transfer')
    .select('*,orders(order_number,buyer_email)').single()

  if (error?.code === 'PGRST116') {
    const { data: existing } = await db.from('refunds').select('id').eq('id', refundId).maybeSingle()
    if (!existing) throw apiError(404, 'REFUND_NOT_FOUND', 'Refund not found')
    throw apiError(409, 'INVALID_STATE', 'Refund was already transferred')
  }
  if (error || !data) throw apiError(500, 'INTERNAL_ERROR', 'Failed to mark refund transferred')

  const order = (data as any).orders
  sendEmail(order.buyer_email, 'Refund telah ditransfer', `Refund pesanan ${order.order_number} sebesar ${data.total_refund_amount} telah ditransfer. Referensi: ${data.transfer_reference}.`)
  return { refund: data }
})
