import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const profileFields = 'id,name,email,phone,address,role,created_at'

export function getProfile(event: H3Event, userId: string) {
  return getSupabaseAdmin(event)
    .from('profiles')
    .select(profileFields)
    .eq('id', userId)
    .single()
}

export function updateProfile(
  event: H3Event,
  userId: string,
  values: { name?: string; phone?: string | null; address?: string | null }
) {
  return getSupabaseAdmin(event)
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select(profileFields)
    .single()
}

export function setRole(event: H3Event, userId: string, role: string) {
  return getSupabaseAdmin(event)
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select(profileFields)
    .single()
}
