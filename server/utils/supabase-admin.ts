import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

// Service-role client bypasses RLS — server-only, never expose to client.
export function getSupabaseAdmin(event: H3Event) {
  return serverSupabaseServiceRole(event)
}
