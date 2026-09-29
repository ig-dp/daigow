import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'
import { getPayoutAccount } from './payout-account.repository'
import { createPayout } from '../utils/xendit'
import { normalizePayoutStatus } from '#shared/utils/payout.mjs'

function getOrderForPayout(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event)
    .from('orders')
    .select('id,order_number,commission_rate_snapshot,trips!inner(jastiper_id),order_items(line_total,item_status)')
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

  const { data: existing, error: existingError } = await admin.from('payouts').select('*').eq('order_id', orderId).maybeSingle()
  if (existingError) throw new Error(`payout: failed to load existing payout: ${existingError.message}`)
  if (existing?.status === 'succeeded' || (existing?.xendit_payout_id && existing.status !== 'failed')) return existing

  const { data: account, error: accountError } = await getPayoutAccount(event, jastiperId)
  if (accountError || !account) throw new Error(`payout: no payout account for jastiper ${jastiperId}`)

  let payout = existing
  if (!payout) {
    const { data, error: insertError } = await admin.from('payouts').insert({
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
    }).select('*').single()
    if (insertError && insertError.code !== '23505') throw new Error(`payout: insert failed: ${insertError.message}`)
    if (data) payout = data
    if (!payout) {
      const { data: concurrent } = await admin.from('payouts').select('*').eq('order_id', orderId).single()
      if (!concurrent) throw new Error('payout: failed to load inserted payout')
      payout = concurrent
    }
  }

  const idempotencyKey = payout.idempotency_key ?? `payout-${orderId}-${payout.attempt ?? 1}`
  try {
    const response = await createPayout({
      externalId: idempotencyKey,
      amount: payout.payout_amount,
      account,
      description: `Daigow payout ${order.order_number}`,
    }, idempotencyKey)
    const xenditPayoutId = response.id ?? response.payout_id ?? response.external_id
    const status = normalizePayoutStatus(response.status)
    const { data: updated, error } = await admin.from('payouts').update({
      xendit_payout_id: xenditPayoutId,
      status,
      failure_reason: null,
      ...(status === 'succeeded' ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', payout.id).select('*').single()
    if (error || !updated) throw new Error(`payout: failed to save provider response: ${error?.message ?? 'empty response'}`)
    return updated
  } catch (error) {
    await admin.from('payouts').update({ status: 'failed', failure_reason: (error as Error).message }).eq('id', payout.id)
    throw error
  }
}

// Retries a failed payout: re-reads the payout account (in case it changed) and bumps attempt/idempotency_key.
export async function retryPayout(event: H3Event, payoutId: string) {
  const admin = getSupabaseAdmin(event)
  const { data: payout, error: findError } = await admin.from('payouts').select('id,order_id,jastiper_id,status,attempt,payout_amount').eq('id', payoutId).single()
  if (findError || !payout) throw new Error(`payout: ${payoutId} not found`)
  if (payout.status !== 'failed') throw new Error(`payout: ${payoutId} is not failed`)

  const { data: account, error: accountError } = await getPayoutAccount(event, payout.jastiper_id)
  if (accountError || !account) throw new Error(`payout: no payout account for jastiper ${payout.jastiper_id}`)

  const attempt = payout.attempt + 1
  const { data: updated, error: updateError } = await admin.from('payouts').update({
    status: 'pending',
    attempt,
    idempotency_key: `payout-${payout.order_id}-${attempt}`,
    bank_code: account.bank_code,
    account_number: account.account_number,
    account_holder_name: account.account_holder_name,
    failure_reason: null,
    requested_at: new Date().toISOString(),
  }).eq('id', payoutId).select('id,status').single()
  if (updateError || !updated) return { data: updated, error: updateError }

  const idempotencyKey = `payout-${payout.order_id}-${attempt}`
  try {
    const response = await createPayout({
      externalId: idempotencyKey,
      amount: payout.payout_amount,
      account,
      description: `Daigow payout retry ${payout.order_id}`,
    }, idempotencyKey)
    const status = normalizePayoutStatus(response.status)
    const xenditPayoutId = response.id ?? response.payout_id ?? response.external_id
    return admin.from('payouts').update({ xendit_payout_id: xenditPayoutId, status, failure_reason: null, ...(status === 'succeeded' ? { completed_at: new Date().toISOString() } : {}) }).eq('id', payoutId).select('id,status').single()
  } catch (error) {
    await admin.from('payouts').update({ status: 'failed', failure_reason: (error as Error).message }).eq('id', payoutId)
    throw error
  }
}

export function findPayoutByProviderId(event: H3Event, providerId: string) {
  return getSupabaseAdmin(event).from('payouts').select('id,status').eq('xendit_payout_id', providerId).single()
}

export function findPayoutByExternalId(event: H3Event, externalId: string) {
  return getSupabaseAdmin(event).from('payouts').select('id,status').eq('idempotency_key', externalId).single()
}

export function updatePayoutStatus(event: H3Event, payoutId: string, status: string, values: Record<string, unknown> = {}) {
  return getSupabaseAdmin(event).from('payouts').update({ status, ...values }).eq('id', payoutId).select('id,status').single()
}
