export async function createPaymentRequest(input: Record<string, unknown>) {
  const secret = process.env.XENDIT_SECRET_KEY
  if (!secret) throw new Error('XENDIT_SECRET_KEY is not configured')
  const response = await fetch('https://api.xendit.co/v3/payment_requests', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`, 'Content-Type': 'application/json', 'api-version': '2024-11-11' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Xendit request failed: ${response.status} ${await response.text()}`)
  return response.json()
}
