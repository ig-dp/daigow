import { readBody } from 'h3'
import { requireUser } from '../../utils/auth'
import { apiError } from '../../utils/api-error'
import { becomeJastiper } from '../../usecases/profile/become-jastiper'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body) || typeof body.code !== 'string' || body.code.length === 0) {
    throw apiError(400, 'INVALID_INPUT', 'code must be a non-empty string')
  }

  return { profile: await becomeJastiper(event, user.id, body.code) }
})
