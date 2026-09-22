import { getHeader } from 'h3'
import { apiError } from '../../utils/api-error'
import { sendEmail } from '../../utils/mailer'
import { getSupabaseAdmin } from '../../utils/supabase-admin'
import { cancelOrderByIds, findAutoCompletable, findExpiredConfirmations, findExpiredPayments } from '../../repositories/order.repository'
import { createPayoutForOrder } from '../../repositories/payout.repository'

export default defineEventHandler(async (event) => {
  if (!process.env.CRON_SECRET || getHeader(event, 'cron-secret') !== process.env.CRON_SECRET) throw apiError(401, 'INVALID_CRON_SECRET', 'Invalid cron secret')
  const now = new Date().toISOString()
  const admin = getSupabaseAdmin(event)
  const result = { confirmation_cancelled: 0, payment_cancelled: 0, payments_expired: 0, auto_completed: 0, payout_failed: 0 }

  const confirmation = await findExpiredConfirmations(event, now)
  if (confirmation.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load confirmation deadlines')
  if (confirmation.data?.length) {
    const updated = await cancelOrderByIds(event, confirmation.data.map((row) => row.id), 'system')
    if (updated.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel expired orders')
    result.confirmation_cancelled = updated.data?.length ?? 0
    confirmation.data.forEach((row) => sendEmail(row.buyer_email, 'Pesanan dibatalkan', 'Pesanan tidak dikonfirmasi tepat waktu.'))
  }

  const payments = await findExpiredPayments(event, now)
  if (payments.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load payment deadlines')
  if (payments.data?.length) {
    const ids = payments.data.map((row) => row.id)
    const updated = await cancelOrderByIds(event, ids, 'system')
    if (updated.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel unpaid orders')
    result.payment_cancelled = updated.data?.length ?? 0
    const expired = await admin.from('payments').update({ status: 'expired' }).in('order_id', ids).eq('status', 'pending').lt('expires_at', now).select('id')
    if (expired.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to expire payments')
    result.payments_expired = expired.data?.length ?? 0
    payments.data.forEach((row) => sendEmail(row.buyer_email, 'Pembayaran kedaluwarsa', 'Pesanan dibatalkan karena pembayaran melewati batas waktu.'))
  }

  const completable = await findAutoCompletable(event, now)
  if (completable.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load auto-complete orders')
  if (completable.data?.length) {
    const completed = await admin.from('orders').update({ status: 'completed', completed_by: 'system', completed_at: now, settled_at: now }).in('id', completable.data.map((row) => row.id)).eq('status', 'delivered').is('issue_reported_at', null).select('id')
    if (completed.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to auto-complete orders')
    result.auto_completed = completed.data?.length ?? 0
    for (const row of completed.data ?? []) {
      try {
        await createPayoutForOrder(event, row.id)
      } catch (err) {
        result.payout_failed++
        console.error('create auto-complete payout failed:', (err as Error).message)
      }
    }
  }
  return result
})
