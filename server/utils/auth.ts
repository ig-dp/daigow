import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { apiError } from './api-error'

export async function requireUser(event: H3Event): Promise<{ id: string }> {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw apiError(401, 'AUTH_REQUIRED', 'Authentication required')
  return { id: user.sub }
}
