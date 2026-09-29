import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { apiError } from './api-error'
import { getSupabaseAdmin } from './supabase-admin'

export async function requireOrderAccess(event: H3Event, orderId: string) {
  const user = await serverSupabaseUser(event).catch(() => null)
  const token = getHeader(event, 'x-tracking-token')
  const query = getSupabaseAdmin(event).from('orders').select('*').eq('id', orderId)
  const { data, error } = user?.sub
    ? await query.eq('buyer_id', user.sub).single()
    : token ? await query.eq('tracking_token', token).single() : { data: null, error: null }
  if (error?.code === 'PGRST116' || !data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  return data
}
