import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { apiError } from './api-error'

// Cookie session (main app) or `Authorization: Bearer <token>` (admin app).
export async function requireUser(event: H3Event): Promise<{ id: string }> {
  const token = getRequestHeader(event, 'authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (token) {
    const client = await serverSupabaseClient(event)
    const { data } = await client.auth.getUser(token)
    if (!data.user) throw apiError(401, 'AUTH_REQUIRED', 'Authentication required')
    return { id: data.user.id }
  }

  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw apiError(401, 'AUTH_REQUIRED', 'Authentication required')
  return { id: user.sub }
}
