import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'
import { getPayoutAccount } from './payout-account.repository'

function getOrderForPayout(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event)
    .from('orders')
    .select('id,commission_rate_snapshot,trips!inner(jastiper_id),order_items(line_total,item_status)')
    .eq('id', orderId)
    .single()
}

// Creates the one pending payout for a completed order. Idempotent: a duplicate order_id insert
// (unique constraint) or an already-existing payout is treated as success, not an error.
export async function createPayoutForOrder(event: H3Event, orderId: string) {
  const admin = getSupabaseAdmin(event)

  const { data: order, error: orderError } = await getOrderForPayout(event, orderId)
  if (orderError || !order) throw new Error(`payout: order ${orderId} not found: ${orderError?.message}`)

  const jastiperId = (order as any).trips.jastiper_id
  const activeSubtotal = (order.order_items as any[]).filter((i) => i.item_status !== 'cancelled').reduce((sum, i) => sum + i.line_total, 0)
  const commissionAmount = Math.round(activeSubtotal * order.commission_rate_snapshot)
  const payoutAmount = activeSubtotal - commissionAmount

  const { data: account, error: accountError } = await getPayoutAccount(event, jastiperId)
  if (accountError || !account) throw new Error(`payout: no payout account for jastiper ${jastiperId}`)

  const { error: insertError } = await admin.from('payouts').insert({
    order_id: orderId,
    jastiper_id: jastiperId,
    active_subtotal: activeSubtotal,
    commission_amount: commissionAmount,
    payout_amount: payoutAmount,
    bank_code: account.bank_code,
    account_number: account.account_number,
    account_holder_name: account.account_holder_name,
    idempotency_key: `payout-${orderId}-1`,
    status: 'pending',
    attempt: 1,
    requested_at: new Date().toISOString(),
  })
  if (insertError && insertError.code !== '23505') throw new Error(`payout: insert failed: ${insertError.message}`)
}

// Retries a failed payout: re-reads the payout account (in case it changed) and bumps attempt/idempotency_key.
export async function retryPayout(event: H3Event, payoutId: string) {
  const admin = getSupabaseAdmin(event)
  const { data: payout, error: findError } = await admin.from('payouts').select('id,order_id,jastiper_id,status,attempt').eq('id', payoutId).single()
  if (findError || !payout) throw new Error(`payout: ${payoutId} not found`)
  if (payout.status !== 'failed') throw new Error(`payout: ${payoutId} is not failed`)

  const { data: account, error: accountError } = await getPayoutAccount(event, payout.jastiper_id)
  if (accountError || !account) throw new Error(`payout: no payout account for jastiper ${payout.jastiper_id}`)

  const attempt = payout.attempt + 1
  return admin.from('payouts').update({
    status: 'pending',
    attempt,
    idempotency_key: `payout-${payout.order_id}-${attempt}`,
    bank_code: account.bank_code,
    account_number: account.account_number,
    account_holder_name: account.account_holder_name,
    failure_reason: null,
    requested_at: new Date().toISOString(),
  }).eq('id', payoutId).select('id,status').single()
}
