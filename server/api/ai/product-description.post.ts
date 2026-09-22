import { readBody } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { consumeAiRequest } from '../../utils/ai-rate-limit'
import { generateProductDescription } from '../../utils/gemini'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  if (!consumeAiRequest(seller.id)) throw apiError(429, 'RATE_LIMITED', 'Too many AI requests')
  const body = await readBody(event)
  if (!body || typeof body.name !== 'string' || !body.name.trim() || typeof body.photo_url !== 'string' || !body.photo_url.trim()) {
    throw apiError(400, 'INVALID_INPUT', 'name and photo_url are required')
  }
  if (body.category !== undefined && typeof body.category !== 'string') throw apiError(400, 'INVALID_INPUT', 'category must be a string')
  try {
    const description = await generateProductDescription(body.name.trim(), body.photo_url.trim(), body.category?.trim())
    return { description }
  } catch (err) {
    console.error('Gemini product description failed:', (err as Error).message)
    throw apiError(502, 'AI_PROVIDER_ERROR', 'Failed to generate product description')
  }
})
