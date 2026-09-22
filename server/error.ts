import { defineNitroErrorHandler } from 'nitropack/runtime'
import { send, setResponseHeaders, setResponseStatus } from 'h3'

export default defineNitroErrorHandler((error, event, { defaultHandler }) => {
  const apiError = error.data?.error
  if (apiError && typeof apiError.code === 'string' && typeof apiError.message === 'string') {
    setResponseHeaders(event, { 'content-type': 'application/json' })
    setResponseStatus(event, error.statusCode || 500, error.statusMessage)
    return send(event, JSON.stringify({ error: apiError }))
  }

  // Unhandled errors on API routes still honor the JSON contract; pages keep Nitro's default.
  if (event.path.startsWith('/api/')) {
    setResponseHeaders(event, { 'content-type': 'application/json' })
    setResponseStatus(event, error.statusCode || 500)
    return send(event, JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }))
  }

  return defaultHandler(error, event)
})
