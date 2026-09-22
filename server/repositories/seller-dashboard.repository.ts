import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const tripFields = 'id,jastiper_id,slug,title,destination,description,thumbnail_url,order_open_at,order_close_at,status,opened_at,closed_at,created_at'

export async function getSellerDashboard(event: H3Event, sellerId: string) {
  const admin = getSupabaseAdmin(event)
  const { data: trips, error: tripsError } = await admin
    .from('trips')
    .select(tripFields)
    .eq('jastiper_id', sellerId)
    .order('created_at', { ascending: false })

  if (tripsError) return { data: null, error: tripsError }

  const tripIds = (trips ?? []).map((trip) => trip.id)
  if (!tripIds.length) {
    return {
      data: {
        stats: { total_trips: 0, active_trips: 0, active_orders: 0, completed_revenue: 0 },
        trips: []
      },
      error: null
    }
  }

  const [productsResult, ordersResult] = await Promise.all([
    admin.from('products').select('trip_id').in('trip_id', tripIds),
    admin.from('orders').select('trip_id,status,subtotal_amount').in('trip_id', tripIds)
  ])

  if (productsResult.error) return { data: null, error: productsResult.error }
  if (ordersResult.error) return { data: null, error: ordersResult.error }

  const productCounts = new Map<string, number>()
  for (const product of productsResult.data ?? []) {
    productCounts.set(product.trip_id, (productCounts.get(product.trip_id) ?? 0) + 1)
  }

  const orderCounts = new Map<string, number>()
  let activeOrders = 0
  let completedRevenue = 0
  for (const order of ordersResult.data ?? []) {
    if (order.status !== 'cancelled') {
      orderCounts.set(order.trip_id, (orderCounts.get(order.trip_id) ?? 0) + 1)
    }
    if (!['completed', 'cancelled'].includes(order.status)) activeOrders++
    if (order.status === 'completed') completedRevenue += Number(order.subtotal_amount ?? 0)
  }

  return {
    data: {
      stats: {
        total_trips: trips?.length ?? 0,
        active_trips: (trips ?? []).filter((trip) => trip.status === 'open').length,
        active_orders: activeOrders,
        completed_revenue: completedRevenue
      },
      trips: (trips ?? []).map((trip) => ({
        ...trip,
        product_count: productCounts.get(trip.id) ?? 0,
        order_count: orderCounts.get(trip.id) ?? 0
      }))
    },
    error: null
  }
}
