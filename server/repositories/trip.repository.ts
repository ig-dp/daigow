import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const tripFields = 'id,jastiper_id,slug,title,destination,description,thumbnail_url,order_open_at,order_close_at,status,opened_at,closed_at,created_at'

type TripValues = {
  title: string
  destination: string
  description?: string
  thumbnail_url: string
  order_open_at: string
  order_close_at: string
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function generateTripSlug(title: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const suffix = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `${slugify(title)}-${suffix}`
}

export function listTrips(event: H3Event, jastiperId: string) {
  return getSupabaseAdmin(event).from('trips').select(tripFields).eq('jastiper_id', jastiperId).order('created_at', { ascending: false })
}

export function insertTrip(event: H3Event, jastiperId: string, values: TripValues) {
  return getSupabaseAdmin(event).from('trips').insert({ jastiper_id: jastiperId, slug: generateTripSlug(values.title), status: 'coming_soon', ...values }).select(tripFields).single()
}

export function getOwnedTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event).from('trips').select(tripFields).eq('jastiper_id', jastiperId).eq('id', tripId).single()
}

export function updateTrip(event: H3Event, jastiperId: string, tripId: string, values: Partial<TripValues>) {
  return getSupabaseAdmin(event).from('trips').update(values).eq('jastiper_id', jastiperId).eq('id', tripId).select(tripFields).single()
}

export function openTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event).from('trips').update({ status: 'open', opened_at: new Date().toISOString() }).eq('jastiper_id', jastiperId).eq('id', tripId).select(tripFields).single()
}

export function closeTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event).from('trips').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('jastiper_id', jastiperId).eq('id', tripId).select(tripFields).single()
}
