import { buildPayoutRequest } from '#shared/utils/payout.mjs'

function xenditHeaders(extra: Record<string, string> = {}) {
  const secret = process.env.XENDIT_SECRET_KEY
  if (!secret) throw new Error('XENDIT_SECRET_KEY is not configured')
  return {
    Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export async function createPaymentRequest(input: Record<string, unknown>) {
  const response = await fetch('https://api.xendit.co/v3/payment_requests', {
    method: 'POST',
    headers: xenditHeaders({ 'api-version': '2024-11-11' }),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Xendit request failed: ${response.status} ${await response.text()}`)
  return response.json()
}

export async function createPaymentSession(input: Record<string, unknown>) {
  const response = await fetch('https://api.xendit.co/sessions', {
    method: 'POST',
    headers: xenditHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Xendit session request failed: ${response.status} ${await response.text()}`)
  return response.json()
}

export async function createPayout(input: Parameters<typeof buildPayoutRequest>[0], idempotencyKey: string) {
  const response = await fetch('https://api.xendit.co/v3/payouts', {
    method: 'POST',
    headers: xenditHeaders({ 'Idempotency-key': idempotencyKey, 'api-version': '2025-09-01' }),
    body: JSON.stringify(buildPayoutRequest(input)),
  })
  if (!response.ok) throw new Error(`Xendit payout request failed: ${response.status} ${await response.text()}`)
  return response.json()
}
