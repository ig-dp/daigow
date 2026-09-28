import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

export function insertPayment(event: H3Event, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('payments').insert(values).select('*').single()
}

export function findPaymentByRequestId(event: H3Event, requestId: string) {
  return getSupabaseAdmin(event).from('payments').select('*,orders!inner(id,status)').eq('xendit_payment_request_id', requestId).single()
}

export function findPaymentByOrderId(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event).from('payments').select('*,orders!inner(id,status)').eq('order_id', orderId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle()
}

export function updatePayment(event: H3Event, paymentId: string, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('payments').update(values).eq('id', paymentId).select('*').single()
}

export async function insertWebhookEvent(event: H3Event, values: Record<string, unknown>) {
  const result = await getSupabaseAdmin(event).from('webhook_events').insert(values).select('id').single()
  if (result.error?.code === '23505') return { data: null, error: null, duplicate: true }
  return { ...result, duplicate: false }
}
