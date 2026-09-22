import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const index = line.indexOf('=')
  return [line.slice(0, index), line.slice(index + 1)]
}))
const supabase = createClient(env.NUXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const photos = {
  'Tote Bag Canvas Jepang': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85',
  'Matcha KitKat Box': 'https://images.unsplash.com/photo-1582234372722-50d7ccc30ebd?auto=format&fit=crop&w=1200&q=85',
  'Skincare Set Hada Labo': 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=85',
  'Figure Anime Limited Edition': 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?auto=format&fit=crop&w=1200&q=85'
}

const { data: trip, error: tripError } = await supabase.from('trips').select('id').eq('slug', 'japan-trip-demo').single()
if (tripError || !trip) throw tripError || new Error('japan-trip-demo tidak ditemukan')
const { data: products, error: productsError } = await supabase.from('products').select('id,name,product_photos(id)').eq('trip_id', trip.id)
if (productsError) throw productsError

for (const product of products ?? []) {
  if (product.product_photos?.length || !photos[product.name]) continue
  const { error } = await supabase.from('product_photos').insert({ product_id: product.id, photo_url: photos[product.name], sort_order: 0 })
  if (error) throw error
  console.log(`Foto ditambahkan: ${product.name}`)
}
