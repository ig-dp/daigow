import { createError } from 'h3'

export function apiError(status: number, code: string, message: string) {
  return createError({
    statusCode: status,
    statusMessage: code,
    data: { error: { code, message } }
  })
}
