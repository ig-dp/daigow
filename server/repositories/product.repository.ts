import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const productFields = 'id,trip_id,name,category,description,description_source,price,created_at,product_photos(id,product_id,photo_url,sort_order),product_variants(id,product_id,name,photo_url,price)'

type Photo = { photo_url: string; sort_order: number }
type Variant = { id?: string; name: string; photo_url?: string; price: number }
export type ProductValues = {
  name: string
  category?: string
  description?: string
  description_source: 'manual' | 'ai' | 'ai_edited'
  price: number
  photos: Photo[]
  variants?: Variant[]
}

export async function insertProduct(event: H3Event, tripId: string, values: ProductValues) {
  const admin = getSupabaseAdmin(event)
  const { photos, variants, ...productValues } = values
  const { data: product, error: productError } = await admin.from('products').insert({ trip_id: tripId, ...productValues }).select('id').single()
  if (productError || !product) return { data: null, error: productError }
  const { error: photosError } = await admin.from('product_photos').insert(photos.map((photo) => ({ product_id: product.id, ...photo })))
  if (photosError) return { data: null, error: photosError }
  if (variants?.length) {
    const { error: variantsError } = await admin.from('product_variants').insert(variants.map((variant) => ({ product_id: product.id, ...variant })))
    if (variantsError) return { data: null, error: variantsError }
  }
  return admin.from('products').select(productFields).eq('id', product.id).single()
}

export function listSellerProducts(event: H3Event, jastiperId: string, filters: { trip_id?: string }) {
  let query = getSupabaseAdmin(event).from('products').select(`${productFields},trips!inner(jastiper_id)`).eq('trips.jastiper_id', jastiperId).order('created_at', { ascending: false })
  if (filters.trip_id) query = query.eq('trip_id', filters.trip_id)
  return query
}

export function getOwnedProduct(event: H3Event, jastiperId: string, productId: string) {
  return getSupabaseAdmin(event).from('products').select(`${productFields},trips!inner(jastiper_id)`).eq('id', productId).eq('trips.jastiper_id', jastiperId).single()
}

export function updateProduct(event: H3Event, productId: string, values: Partial<Omit<ProductValues, 'photos' | 'variants'>>) {
  return getSupabaseAdmin(event).from('products').update(values).eq('id', productId).select(productFields).single()
}

export async function replaceProductPhotos(event: H3Event, productId: string, photos: Photo[]) {
  const admin = getSupabaseAdmin(event)
  const { error } = await admin.from('product_photos').delete().eq('product_id', productId)
  if (error) return { error }
  return admin.from('product_photos').insert(photos.map((photo) => ({ product_id: productId, ...photo })))
}

export async function replaceProductVariants(event: H3Event, productId: string, variants: Variant[], existingIds: string[]) {
  const admin = getSupabaseAdmin(event)
  const retainedIds = variants.flatMap((variant) => variant.id ? [variant.id] : [])
  const removedIds = existingIds.filter((id) => !retainedIds.includes(id))
  if (removedIds.length) {
    const { count, error } = await admin.from('order_items').select('id', { count: 'exact', head: true }).in('variant_id', removedIds)
    if (error) return { error }
    if (count) return { error: { code: 'VARIANT_IN_USE', message: 'Variant is used by an order' } }
  }

  for (const variant of variants) {
    const { id, ...values } = variant
    const result = id
      ? await admin.from('product_variants').update(values).eq('product_id', productId).eq('id', id)
      : await admin.from('product_variants').insert({ product_id: productId, ...values })
    if (result.error) return { error: result.error }
  }
  if (removedIds.length) {
    const { error } = await admin.from('product_variants').delete().eq('product_id', productId).in('id', removedIds)
    if (error) return { error }
  }
  return { error: null }
}

export async function productHasOrderItems(event: H3Event, productId: string) {
  const { count, error } = await getSupabaseAdmin(event).from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId)
  return { data: (count ?? 0) > 0, error }
}

export function deleteProduct(event: H3Event, productId: string) {
  return getSupabaseAdmin(event).from('products').delete().eq('id', productId)
}
