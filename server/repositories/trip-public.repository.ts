import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const tripWithProductsFields = `
  id,jastiper_id,slug,title,destination,description,thumbnail_url,order_open_at,order_close_at,status,opened_at,closed_at,created_at,
  products (
    id,trip_id,name,category,description,description_source,price,created_at,
    product_photos ( id,product_id,photo_url,sort_order ),
    product_variants ( id,product_id,name,photo_url,price )
  )
`

export function getTripBySlug(event: H3Event, slug: string) {
  return getSupabaseAdmin(event).from('trips').select(tripWithProductsFields).eq('slug', slug).single()
}

export function getTripStatus(event: H3Event, tripId: string) {
  return getSupabaseAdmin(event).from('trips').select('id,status').eq('id', tripId).single()
}

export function insertSubscriber(event: H3Event, tripId: string, email: string) {
  return getSupabaseAdmin(event).from('trip_subscribers').upsert({ trip_id: tripId, email }, { onConflict: 'trip_id,email' }).select('id,trip_id,email,notified_at,created_at').single()
}
