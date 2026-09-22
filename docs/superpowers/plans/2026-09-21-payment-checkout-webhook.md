# Payment Checkout and Xendit Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated buyer checkout through Xendit Payment Request v3 and idempotent Xendit payment callbacks.

**Architecture:** Thin Nitro handlers validate input, auth, lifecycle, and webhook token. Repository functions use the Supabase service-role client for orders, payments, and webhook events. Checkout calls Xendit directly before inserting a pending payment; webhook records the event before applying payment/order transitions.

**Tech Stack:** Nuxt 4 / Nitro, H3, Supabase service-role client, Xendit Payment Request API v3, Node built-in test runner.

## Global Constraints

- Checkout requires authenticated buyer ownership (`orders.buyer_id = user.id`).
- Checkout only accepts `awaiting_payment` orders before `payment_deadline`.
- Xendit endpoint: `POST /v3/payment_requests`; auth uses `XENDIT_SECRET_KEY`.
- Webhook auth uses `x-callback-token` against `XENDIT_WEBHOOK_TOKEN`.
- Channel fees: BCA VA `4000`; QRIS `Math.round(amount * 0.007)`.
- Webhook events insert before mutation; duplicate `event_id` is a successful no-op.
- No new dependency; use native `fetch`.
- No commit unless explicitly requested.

---

### Task 1: Fee helpers, payment/webhook repositories, and pure tests

**Files:**
- Modify: `server/utils/fees.ts`
- Modify: `server/repositories/order.repository.ts`
- Create: `server/repositories/payment.repository.ts`
- Modify: `tests/profile-api.test.mjs`

**Interfaces:**
- Produces `getChannelFee(method: 'va' | 'qris', channelCode: string): number`.
- Produces payment repository functions: `insertPayment`, `findPaymentByRequestId`, `updatePayment`, `insertWebhookEvent`.
- `insertWebhookEvent` returns duplicate status when Supabase reports unique violation `23505`.

- [ ] **Step 1: Append pure tests**

```js
function channelFee(method, channelCode, amount) {
  if (method === 'va' && channelCode === 'BCA') return 4000
  if (method === 'qris' && channelCode === 'QRIS') return Math.round(amount * 0.007)
  return null
}

test('checkout channel fees use supported methods', () => {
  assert.strictEqual(channelFee('va', 'BCA', 100000), 4000)
  assert.strictEqual(channelFee('qris', 'QRIS', 100000), 700)
  assert.strictEqual(channelFee('va', 'MANDIRI', 100000), null)
})

test('checkout accepts only awaiting payment before deadline', () => {
  const valid = (status, now, deadline) => status === 'awaiting_payment' && now < deadline
  assert.strictEqual(valid('awaiting_payment', 5, 10), true)
  assert.strictEqual(valid('processing', 5, 10), false)
  assert.strictEqual(valid('awaiting_payment', 10, 10), false)
})

function applyPaymentWebhook(orderStatus, paymentStatus, eventStatus) {
  if (eventStatus === 'SUCCEEDED' && paymentStatus !== 'paid' && orderStatus === 'awaiting_payment') return { payment: 'paid', order: 'processing' }
  if (eventStatus === 'SUCCEEDED') return { payment: paymentStatus, order: orderStatus }
  return { payment: eventStatus === 'EXPIRED' ? 'expired' : 'failed', order: orderStatus }
}

test('payment webhook transitions successful payment once', () => {
  assert.deepStrictEqual(applyPaymentWebhook('awaiting_payment', 'pending', 'SUCCEEDED'), { payment: 'paid', order: 'processing' })
  assert.deepStrictEqual(applyPaymentWebhook('processing', 'paid', 'SUCCEEDED'), { payment: 'paid', order: 'processing' })
  assert.deepStrictEqual(applyPaymentWebhook('awaiting_payment', 'pending', 'EXPIRED'), { payment: 'expired', order: 'awaiting_payment' })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Add fee helper**

```ts
export function getChannelFee(method: 'va' | 'qris', channelCode: string, amount: number) {
  if (method === 'va' && channelCode === 'BCA') return 4000
  if (method === 'qris' && channelCode === 'QRIS') return Math.round(amount * 0.007)
  return null
}
```

- [ ] **Step 4: Add payment repository**

`server/repositories/payment.repository.ts` must use `getSupabaseAdmin(event)` and expose:

```ts
export function insertPayment(event: H3Event, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('payments').insert(values).select('*').single()
}

export function findPaymentByRequestId(event: H3Event, requestId: string) {
  return getSupabaseAdmin(event).from('payments').select('*,orders!inner(id,status)').eq('xendit_payment_request_id', requestId).single()
}

export function updatePayment(event: H3Event, paymentId: string, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('payments').update(values).eq('id', paymentId).select('*').single()
}

export async function insertWebhookEvent(event: H3Event, values: Record<string, unknown>) {
  const result = await getSupabaseAdmin(event).from('webhook_events').insert(values).select('id').single()
  if (result.error?.code === '23505') return { data: null, error: null, duplicate: true }
  return { ...result, duplicate: false }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

---

### Task 2: Xendit client and checkout endpoint

**Files:**
- Create: `server/utils/xendit.ts`
- Create: `server/api/orders/[id]/checkout.post.ts`

**Interfaces:**
- `createPaymentRequest(input: Record<string, unknown>): Promise<any>` calls `POST https://api.xendit.co/v3/payment_requests` with Basic auth and JSON.
- Checkout consumes `getOwnedOrder`, `insertPayment`, `updateOrderStatus`, and `getChannelFee`.

- [ ] **Step 1: Add Xendit client**

```ts
export async function createPaymentRequest(input: Record<string, unknown>) {
  const secret = process.env.XENDIT_SECRET_KEY
  if (!secret) throw new Error('XENDIT_SECRET_KEY is not configured')
  const response = await fetch('https://api.xendit.co/v3/payment_requests', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Xendit request failed: ${response.status}`)
  return response.json()
}
```

- [ ] **Step 2: Add checkout validation and lifecycle gate**

Handler requirements:
- `requireUser(event)`.
- Read JSON body; reject non-object, unsupported method, and unsupported channel.
- Fetch order owned by buyer; missing/foreign order returns `404 ORDER_NOT_FOUND`.
- Reject status/deadline mismatch with `409 INVALID_STATE`.
- Resolve `channelCode = body.method === 'va' ? body.channel_code ?? 'BCA' : 'QRIS'`.
- Compute `channelFee`, charged amount, and provider expiry.

- [ ] **Step 3: Call Xendit then persist payment**

Provider request must include order reference, amount, currency `IDR`, payment method configuration for `VIRTUAL_ACCOUNT` or `QR_CODE`, and an expiry. Provider failure returns `502 PAYMENT_PROVIDER_ERROR` and creates no payment row.

After success, insert `payments` with `pending`, provider request ID, method/channel, fee, amount, and expiry. Then update order `channel_fee_amount` and `total_amount`. Return `{ payment: { id, status, amount, expires_at, provider } }` with provider instructions.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS; build succeeds.

---

### Task 3: Xendit webhook endpoint

**Files:**
- Create: `server/api/webhooks/xendit.post.ts`

**Interfaces:**
- Consumes `insertWebhookEvent`, `findPaymentByRequestId`, `updatePayment`, and `updateOrderStatus`.
- Returns `{ received: true }` for every valid-token callback, including duplicates and unknown payments.

- [ ] **Step 1: Validate callback token and payload**

Use `getHeader(event, 'x-callback-token')`; compare exactly with `process.env.XENDIT_WEBHOOK_TOKEN`. Missing/mismatched token throws `apiError(401, 'INVALID_WEBHOOK_TOKEN', 'Invalid webhook token')`. Read body and reject malformed payload with `400 INVALID_INPUT`.

- [ ] **Step 2: Persist event before mutation**

Extract event ID from `body.event_id ?? body.id`; event type from `body.event_type ?? body.event`; payment request ID from `body.data.payment_request_id ?? body.payment_request_id`; provider status from `body.data.status ?? body.status`. Missing event ID returns `400 INVALID_INPUT`. Insert raw payload with provider `xendit`. Duplicate returns `{ received: true, duplicate: true }`.

- [ ] **Step 3: Apply payment state transition**

Unknown payment request ID returns `{ received: true }` after event persistence. For `SUCCEEDED`, update payment to `paid` with `paid_at`, then update the joined order to `processing` only when current status is `awaiting_payment`. For `FAILED` update payment `failed`; for `EXPIRED` update payment `expired`. Existing paid/processing state remains unchanged.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS; build succeeds.

---

## Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] Checkout rejects non-owner, wrong status, expired deadline, unsupported channel.
- [ ] Provider failure returns 502 without payment row.
- [ ] Webhook rejects invalid callback token.
- [ ] Duplicate event is a no-op.
- [ ] Success callback changes pending payment to paid and awaiting-payment order to processing.
- [ ] Failed/expired callback updates payment only.
- [ ] Unknown payment request remains recorded for future admin inspection.
- [ ] Supabase contains `payments` and `webhook_events` tables matching `PRD/DATA_MODEL.md`.
