import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '../utils/supabase-admin'
import { COMMISSION_RATE, PLATFORM_FEE_RATE } from '../utils/fees'

const orderFields = 'id,order_number,trip_id,buyer_id,buyer_name,buyer_email,buyer_phone,shipping_address,tracking_token,status,confirmation_deadline,subtotal_amount,platform_fee_amount,total_amount,created_at,order_items(id,product_id,variant_id,quantity,unit_price,line_total,product_name_snapshot,category_snapshot,variant_name_snapshot,snapshot_photo_url,item_status)'
const sellerOrderFields = `${orderFields},confirmed_at,payment_deadline,paid_at,cancellation_reason,cancelled_by,shipping_evidence_url,tracking_number,shipped_at,delivered_at,delivered_by,auto_complete_at,completed_at,completed_by,issue_reported_at,issue_note,issue_resolved_at,issue_resolution,platform_fee_rate_snapshot,commission_rate_snapshot,channel_fee_amount,settled_at`

export type OrderItemInput = { product_id: string; variant_id?: string; quantity: number }
export type OrderInsertValues = {
  trip_id: string
  buyer_id: string | null
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  shipping_address: string
  items: Array<{
    product_id: string
    variant_id: string | null
    quantity: number
    unit_price: number
    line_total: number
    product_name_snapshot: string
    category_snapshot: string | null
    variant_name_snapshot: string | null
    snapshot_photo_url: string
  }>
}

export function generateOrderNumber(): string {
  const today = new Date()
  const yy = String(today.getUTCFullYear()).slice(2)
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(today.getUTCDate()).padStart(2, '0')
  return `DG-${yy}${mm}${dd}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
}

export function generateTrackingToken() {
  return randomBytes(32).toString('base64url')
}

export function getOpenTrip(event: H3Event, tripId: string) {
  return getSupabaseAdmin(event).from('trips').select('id,status,order_open_at,order_close_at').eq('id', tripId).single()
}

export function getProductsForOrder(event: H3Event, tripId: string, productIds: string[]) {
  return getSupabaseAdmin(event).from('products').select('id,trip_id,name,category,price,product_photos(photo_url,sort_order),product_variants(id,name,photo_url,price)').eq('trip_id', tripId).in('id', productIds)
}

export async function insertOrder(event: H3Event, values: OrderInsertValues) {
  const admin = getSupabaseAdmin(event)
  const { items, ...orderValues } = values
  const subtotal_amount = items.reduce((sum, item) => sum + item.line_total, 0)
  const platform_fee_amount = Math.round(subtotal_amount * PLATFORM_FEE_RATE)
  const total_amount = subtotal_amount + platform_fee_amount
  const confirmation_deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const tracking_token = generateTrackingToken()

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: order, error: orderError } = await admin.from('orders').insert({
      ...orderValues,
      order_number: generateOrderNumber(),
      tracking_token,
      status: 'awaiting_confirmation',
      confirmation_deadline,
      subtotal_amount,
      platform_fee_rate_snapshot: PLATFORM_FEE_RATE,
      platform_fee_amount,
      commission_rate_snapshot: COMMISSION_RATE,
      channel_fee_amount: 0,
      total_amount,
    }).select('id').single()

    if (orderError?.code === '23505') continue
    if (orderError || !order) return { data: null, error: orderError }

    const { error: itemsError } = await admin.from('order_items').insert(items.map((item) => ({ order_id: order.id, item_status: 'active', ...item })))
    if (itemsError) return { data: null, error: itemsError }
    return { data: { id: order.id, tracking_token }, error: null }
  }
  return { data: null, error: { message: 'order_number collision retry exhausted' } }
}

export function getOrderByTrackingToken(event: H3Event, token: string) {
  return getSupabaseAdmin(event).from('orders').select(orderFields).eq('tracking_token', token).single()
}

export function listOrdersForBuyer(event: H3Event, buyerId: string) {
  return getSupabaseAdmin(event).from('orders').select(orderFields).eq('buyer_id', buyerId).order('created_at', { ascending: false })
}

export function listSellerOrders(event: H3Event, jastiperId: string, filters: { trip_id?: string; status?: string }) {
  let query = getSupabaseAdmin(event).from('orders').select(`${orderFields},trips!inner(jastiper_id)`).eq('trips.jastiper_id', jastiperId).order('created_at', { ascending: false })
  if (filters.trip_id) query = query.eq('trip_id', filters.trip_id)
  if (filters.status) query = query.eq('status', filters.status)
  return query
}

export async function countAwaitingConfirmationByTrip(event: H3Event, tripIds: string[]) {
  const counts = new Map<string, number>()
  if (!tripIds.length) return { counts, error: null }
  const { data, error } = await getSupabaseAdmin(event).from('orders').select('trip_id').eq('status', 'awaiting_confirmation').in('trip_id', tripIds)
  for (const order of data ?? []) counts.set(order.trip_id, (counts.get(order.trip_id) ?? 0) + 1)
  return { counts, error }
}

export function getOwnedOrder(event: H3Event, jastiperId: string, orderId: string) {
  return getSupabaseAdmin(event).from('orders').select(`${sellerOrderFields},trips!inner(jastiper_id)`).eq('id', orderId).eq('trips.jastiper_id', jastiperId).single()
}

export async function getOrderSettlement(event: H3Event, orderId: string) {
  const admin = getSupabaseAdmin(event)
  const [payout, refunds] = await Promise.all([
    admin.from('payouts').select('status,payout_amount,commission_amount,failure_reason').eq('order_id', orderId).maybeSingle(),
    admin.from('refunds').select('id,refund_type,status,total_refund_amount').eq('order_id', orderId).order('created_at', { ascending: false })
  ])
  return { payout: payout.data, refunds: refunds.data ?? [], error: payout.error ?? refunds.error }
}

export function listAdminOrders(event: H3Event, onHold: boolean) {
  let query = getSupabaseAdmin(event).from('orders').select(sellerOrderFields).order('created_at', { ascending: false })
  if (onHold) query = query.not('issue_reported_at', 'is', null).is('issue_resolved_at', null)
  return query
}

export function getAdminOrder(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event).from('orders').select(`${sellerOrderFields},payments(*),payouts(*),refunds(*)`).eq('id', orderId).single()
}

// Conditional: only an unresolved on-hold order in one of `statuses` changes. 0 rows (PGRST116) → already resolved or wrong status.
export function resolveAdminOrder(event: H3Event, orderId: string, statuses: string[], values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('orders').update(values).eq('id', orderId)
    .not('issue_reported_at', 'is', null).is('issue_resolved_at', null).in('status', statuses)
    .select(sellerOrderFields).single()
}

export function cancelActiveOrderItems(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event).from('order_items').update({ item_status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('order_id', orderId).eq('item_status', 'active')
}

export function getOrderForBuyerCheckout(event: H3Event, buyerId: string, orderId: string) {
  return getSupabaseAdmin(event).from('orders').select('id,status,total_amount,payment_deadline').eq('id', orderId).eq('buyer_id', buyerId).single()
}

export function updateOrderPaymentTotals(event: H3Event, orderId: string, channelFee: number, totalAmount: number) {
  return getSupabaseAdmin(event).from('orders').update({ channel_fee_amount: channelFee, total_amount: totalAmount }).eq('id', orderId).select('id,total_amount,channel_fee_amount').single()
}

export function transitionOrderToProcessing(event: H3Event, orderId: string) {
  return getSupabaseAdmin(event).from('orders').update({ status: 'processing' }).eq('id', orderId).eq('status', 'awaiting_payment').select('id,status').single()
}

export function updateOrderPaidAt(event: H3Event, orderId: string, paidAt: string) {
  return getSupabaseAdmin(event).from('orders').update({ paid_at: paidAt }).eq('id', orderId).select('id,paid_at').single()
}

export function updateOrderStatus(event: H3Event, orderId: string, values: Record<string, unknown>, expectedStatus?: string, blockOnHold = false) {
  let query = getSupabaseAdmin(event).from('orders').update(values).eq('id', orderId)
  if (expectedStatus) query = query.eq('status', expectedStatus)
  if (blockOnHold) query = query.is('issue_reported_at', null)
  return query.select(orderFields).single()
}

export function completeOrder(event: H3Event, orderId: string, completedBy: 'buyer' | 'system' | 'admin') {
  return getSupabaseAdmin(event).from('orders').update({ status: 'completed', completed_by: completedBy, completed_at: new Date().toISOString(), settled_at: new Date().toISOString() }).eq('id', orderId).eq('status', 'delivered').is('issue_reported_at', null).select('id,status').single()
}

export function reportOrderIssue(event: H3Event, orderId: string, note: string) {
  return getSupabaseAdmin(event).from('orders').update({ issue_note: note, issue_reported_at: new Date().toISOString() }).eq('id', orderId).in('status', ['processing', 'shipped', 'delivered']).is('issue_reported_at', null).select('id,status,issue_reported_at').single()
}

export function findExpiredConfirmations(event: H3Event, now: string) {
  return getSupabaseAdmin(event).from('orders').select('id,buyer_email').eq('status', 'awaiting_confirmation').lt('confirmation_deadline', now)
}

export function findExpiredPayments(event: H3Event, now: string) {
  return getSupabaseAdmin(event).from('orders').select('id,buyer_email').eq('status', 'awaiting_payment').lt('payment_deadline', now)
}

export function findAutoCompletable(event: H3Event, now: string) {
  return getSupabaseAdmin(event).from('orders').select('id,buyer_email').eq('status', 'delivered').is('issue_reported_at', null).lt('auto_complete_at', now)
}

export function cancelOrderByIds(event: H3Event, ids: string[], cancelledBy: 'system') {
  return getSupabaseAdmin(event).from('orders').update({ status: 'cancelled', cancelled_by: cancelledBy, settled_at: new Date().toISOString() }).in('id', ids).select('id')
}

export function getOwnedOrderItem(event: H3Event, jastiperId: string, orderItemId: string) {
  return getSupabaseAdmin(event).from('order_items').select('id,order_id,line_total,item_status,orders!inner(id,status,issue_reported_at,issue_resolved_at,platform_fee_amount,buyer_email,trip_id,trips!inner(jastiper_id))').eq('id', orderItemId).eq('orders.trips.jastiper_id', jastiperId).single()
}

export function updateOrderItemStatus(event: H3Event, orderItemId: string, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('order_items').update(values).eq('id', orderItemId).eq('item_status', 'active').select('id,order_id,item_status').single()
}

export async function countActiveOrderItems(event: H3Event, orderId: string, excludeItemId: string) {
  const { count, error } = await getSupabaseAdmin(event).from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId).eq('item_status', 'active').neq('id', excludeItemId)
  return { data: count ?? 0, error }
}

export function insertRefund(event: H3Event, values: { order_id: string; order_item_id: string | null; refund_type: string; item_amount_refunded: number; platform_fee_refunded: number; total_refund_amount: number }) {
  return getSupabaseAdmin(event).from('refunds').insert({ ...values, channel_fee_refunded: 0, status: 'pending_transfer' }).select('*').single()
}
