# Orders Buyer API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add order creation and read-only tracking for buyers (guest or logged-in): `POST /api/orders`, `GET /api/orders/track/:token`, `GET /api/me/orders`.

**Architecture:** Thin Nitro handlers validate input and trip/product state; `order.repository.ts` performs Supabase service-role queries in one insert flow. Fee rates are hardcoded constants in `server/utils/fees.ts`. Email is a stub logger in `server/utils/mailer.ts`.

**Tech Stack:** Nuxt 4 / Nitro (H3), @nuxtjs/supabase, Node built-in test runner.

## Global Constraints

- All error responses use `{ error: { code, message } }` via `apiError(status, code, message)`.
- Amounts are IDR whole numbers, rounded half-up (`Math.round`).
- `PLATFORM_FEE_RATE = 0.015`, `COMMISSION_RATE = 0.025`.
- `buyer_name`/`buyer_email`/`buyer_phone`/`shipping_address` always required in body regardless of login state.
- No storage/compression job — `snapshot_photo_url` reuses the existing photo URL directly.
- No commit unless explicitly requested by the user.
- Tests: inlined pure functions appended to `tests/profile-api.test.mjs`, following the existing pattern (not importing TS route code).

---

### Task 1: Fee constants, mailer stub, and order repository

**Files:**
- Create: `server/utils/fees.ts`
- Create: `server/utils/mailer.ts`
- Create: `server/repositories/order.repository.ts`
- Test: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Produces: `PLATFORM_FEE_RATE: number`, `COMMISSION_RATE: number` (from `server/utils/fees.ts`).
- Produces: `sendEmail(to: string, subject: string, body: string): void` (from `server/utils/mailer.ts`).
- Produces (from `server/repositories/order.repository.ts`):
  - `generateOrderNumber(): string` — `DG-<YYMMDD>-<4-digit random>`.
  - `generateTrackingToken(): string` — 32 random bytes, base64url.
  - `getOpenTrip(event, tripId): PromiseLike<{ data, error }>` — trip by id.
  - `getProductsForOrder(event, tripId, productIds: string[]): PromiseLike<{ data, error }>` — products (with `product_photos`, `product_variants`) scoped to trip.
  - `type OrderItemInput = { product_id: string; variant_id?: string; quantity: number }`
  - `type OrderInsertValues = { trip_id: string; buyer_id: string | null; buyer_name: string; buyer_email: string; buyer_phone: string; shipping_address: string; items: Array<{ product_id: string; variant_id: string | null; quantity: number; unit_price: number; line_total: number; product_name_snapshot: string; category_snapshot: string | null; variant_name_snapshot: string | null; snapshot_photo_url: string }> }`
  - `insertOrder(event, values: OrderInsertValues): Promise<{ data: { id: string; tracking_token: string } | null; error: any }>` — computes subtotal/fees/tokens internally, inserts `orders` + `order_items`, retries once on `order_number` unique-constraint conflict (Postgres code `23505`).
  - `getOrderByTrackingToken(event, token): PromiseLike<{ data, error }>` — order + `order_items`.
  - `listOrdersForBuyer(event, buyerId): PromiseLike<{ data, error }>` — orders + `order_items`, `buyer_id` eq, `created_at` desc.

- [ ] **Step 1: Write the failing tests**

Append to `tests/profile-api.test.mjs`:

```js
function roundFee(subtotal, rate) {
  return Math.round(subtotal * rate)
}

test('platform fee rounds half-up on subtotal', () => {
  assert.strictEqual(roundFee(100000, 0.015), 1500)
  assert.strictEqual(roundFee(333, 0.015), 5) // 4.995 -> 5
})

function computeOrderTotals(items) {
  const subtotal_amount = items.reduce((sum, i) => sum + i.line_total, 0)
  const platform_fee_amount = roundFee(subtotal_amount, 0.015)
  const total_amount = subtotal_amount + platform_fee_amount
  return { subtotal_amount, platform_fee_amount, total_amount }
}

test('order totals sum line totals and add platform fee', () => {
  const items = [{ line_total: 100000 }, { line_total: 50000 }]
  const totals = computeOrderTotals(items)
  assert.strictEqual(totals.subtotal_amount, 150000)
  assert.strictEqual(totals.platform_fee_amount, 2250)
  assert.strictEqual(totals.total_amount, 152250)
})

function isValidOrderNumber(n) {
  return /^DG-\d{6}-\d{4}$/.test(n)
}

test('order number matches DG-YYMMDD-#### format', () => {
  assert.strictEqual(isValidOrderNumber('DG-260921-4821'), true)
  assert.strictEqual(isValidOrderNumber('DG-2609-4821'), false)
  assert.strictEqual(isValidOrderNumber('dg-260921-4821'), false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: These 3 new tests FAIL (functions not yet referenced correctly — actually since they're pure local functions they'll pass immediately; this step just confirms no syntax errors broke the file). If they pass immediately, that's fine — they're pure-logic tests mirroring the repository's real computation, not TDD-driving the repository file itself (Supabase calls can't run in `node:test` without a live DB). Proceed to Step 3.

- [ ] **Step 3: Create fee constants**

`server/utils/fees.ts`:
```ts
export const PLATFORM_FEE_RATE = 0.015
export const COMMISSION_RATE = 0.025
```

- [ ] **Step 4: Create mailer stub**

`server/utils/mailer.ts`:
```ts
// ponytail: console.log stub, swap for real provider (Resend/SendGrid) when chosen
export function sendEmail(to: string, subject: string, body: string) {
  console.log(`[mailer] to=${to} subject="${subject}"\n${body}`)
}
```

- [ ] **Step 5: Create order repository**

`server/repositories/order.repository.ts`:
```ts
import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '../utils/supabase-admin'
import { PLATFORM_FEE_RATE, COMMISSION_RATE } from '../utils/fees'

const orderFields = 'id,order_number,trip_id,buyer_id,buyer_name,buyer_email,buyer_phone,shipping_address,tracking_token,status,confirmation_deadline,subtotal_amount,platform_fee_amount,total_amount,created_at,order_items(id,product_id,variant_id,quantity,unit_price,line_total,product_name_snapshot,category_snapshot,variant_name_snapshot,snapshot_photo_url,item_status)'

export function generateOrderNumber(): string {
  const today = new Date()
  const yy = String(today.getUTCFullYear()).slice(2)
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(today.getUTCDate()).padStart(2, '0')
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `DG-${yy}${mm}${dd}-${suffix}`
}

export function generateTrackingToken(): string {
  return randomBytes(32).toString('base64url')
}

export function getOpenTrip(event: H3Event, tripId: string) {
  return getSupabaseAdmin(event).from('trips').select('id,status,order_open_at,order_close_at').eq('id', tripId).single()
}

export function getProductsForOrder(event: H3Event, tripId: string, productIds: string[]) {
  return getSupabaseAdmin(event)
    .from('products')
    .select('id,trip_id,name,category,price,product_photos(photo_url,sort_order),product_variants(id,name,photo_url,price)')
    .eq('trip_id', tripId)
    .in('id', productIds)
}

type OrderItemInput = { product_id: string; variant_id?: string; quantity: number }

type OrderInsertValues = {
  trip_id: string
  buyer_id: string | null
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  shipping_address: string
  items: Array<{
    product_id: string
    variant_id: string | null
    quantity: number
    unit_price: number
    line_total: number
    product_name_snapshot: string
    category_snapshot: string | null
    variant_name_snapshot: string | null
    snapshot_photo_url: string
  }>
}

export async function insertOrder(event: H3Event, values: OrderInsertValues) {
  const admin = getSupabaseAdmin(event)
  const { items, ...orderValues } = values
  const subtotal_amount = items.reduce((sum, i) => sum + i.line_total, 0)
  const platform_fee_amount = Math.round(subtotal_amount * PLATFORM_FEE_RATE)
  const total_amount = subtotal_amount + platform_fee_amount
  const now = new Date()
  const confirmation_deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const tracking_token = generateTrackingToken()

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        ...orderValues,
        order_number: generateOrderNumber(),
        tracking_token,
        status: 'awaiting_confirmation',
        confirmation_deadline,
        subtotal_amount,
        platform_fee_rate_snapshot: PLATFORM_FEE_RATE,
        platform_fee_amount,
        commission_rate_snapshot: COMMISSION_RATE,
        channel_fee_amount: 0,
        total_amount,
      })
      .select('id')
      .single()

    if (orderError?.code === '23505') continue // order_number collision, retry
    if (orderError || !order) return { data: null, error: orderError }

    const { error: itemsError } = await admin.from('order_items').insert(
      items.map((item) => ({ order_id: order.id, item_status: 'active', ...item }))
    )
    if (itemsError) return { data: null, error: itemsError }

    return { data: { id: order.id, tracking_token }, error: null }
  }
  return { data: null, error: { message: 'order_number collision retry exhausted' } }
}

export function getOrderByTrackingToken(event: H3Event, token: string) {
  return getSupabaseAdmin(event).from('orders').select(orderFields).eq('tracking_token', token).single()
}

export function listOrdersForBuyer(event: H3Event, buyerId: string) {
  return getSupabaseAdmin(event).from('orders').select(orderFields).eq('buyer_id', buyerId).order('created_at', { ascending: false })
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test`
Expected: PASS (all tests including the 3 new ones)

---

### Task 2: `POST /api/orders`

**Files:**
- Create: `server/api/orders/index.post.ts`
- Test: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Consumes: `getOpenTrip`, `getProductsForOrder`, `insertOrder` from `../../repositories/order.repository` (Task 1); `sendEmail` from `../../utils/mailer` (Task 1); `apiError` from `../../utils/api-error`; `requireUser`-style optional session read via `serverSupabaseUser(event)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/profile-api.test.mjs`:

```js
function isValidOrderCreateBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const REQUIRED = ['trip_id', 'items', 'buyer_name', 'buyer_email', 'buyer_phone', 'shipping_address']
  const ALLOWED = new Set(REQUIRED)
  for (const key of Object.keys(body)) if (!ALLOWED.has(key)) return false
  for (const key of REQUIRED) if (!(key in body)) return false
  if (typeof body.trip_id !== 'string' || !body.trip_id) return false
  if (!Array.isArray(body.items) || body.items.length === 0) return false
  for (const item of body.items) {
    if (typeof item !== 'object' || item === null) return false
    if (typeof item.product_id !== 'string' || !item.product_id) return false
    if ('variant_id' in item && typeof item.variant_id !== 'string') return false
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) return false
  }
  if (typeof body.buyer_name !== 'string' || !body.buyer_name) return false
  if (typeof body.buyer_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.buyer_email)) return false
  if (typeof body.buyer_phone !== 'string' || !body.buyer_phone) return false
  if (typeof body.shipping_address !== 'string' || !body.shipping_address) return false
  return true
}

test('order create validation enforces required fields and item shape', () => {
  const valid = { trip_id: 't1', items: [{ product_id: 'p1', quantity: 2 }], buyer_name: 'Budi', buyer_email: 'a@b.com', buyer_phone: '0812', shipping_address: 'Jl. X' }
  assert.strictEqual(isValidOrderCreateBody(valid), true)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [] }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [{ product_id: 'p1', quantity: 0 }] }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, buyer_email: 'bad' }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, extra: 'x' }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [{ product_id: 'p1', variant_id: 'v1', quantity: 1 }] }), true)
})

test('trip must be open and within order window to accept orders', () => {
  const canOrder = (status, now, openAt, closeAt) => status === 'open' && now >= openAt && now <= closeAt
  assert.strictEqual(canOrder('open', 5, 1, 10), true)
  assert.strictEqual(canOrder('coming_soon', 5, 1, 10), false)
  assert.strictEqual(canOrder('open', 11, 1, 10), false)
  assert.strictEqual(canOrder('open', 0, 1, 10), false)
})

test('variant required when product has variants', () => {
  const needsVariant = (variants, variant_id) => (variants.length > 0 ? Boolean(variant_id) : true)
  assert.strictEqual(needsVariant([{ id: 'v1' }], undefined), false)
  assert.strictEqual(needsVariant([{ id: 'v1' }], 'v1'), true)
  assert.strictEqual(needsVariant([], undefined), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: PASS immediately (pure functions) — confirms no syntax errors. Proceed.

- [ ] **Step 3: Write the endpoint**

`server/api/orders/index.post.ts`:
```ts
import { readBody } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { apiError } from '../../utils/api-error'
import { sendEmail } from '../../utils/mailer'
import { getOpenTrip, getProductsForOrder, insertOrder } from '../../repositories/order.repository'

const REQUIRED_KEYS = ['trip_id', 'items', 'buyer_name', 'buyer_email', 'buyer_phone', 'shipping_address']
const ALLOWED_KEYS = new Set(REQUIRED_KEYS)
const isEmail = (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isItem = (value: any) =>
  value && typeof value === 'object' && !Array.isArray(value) &&
  typeof value.product_id === 'string' && value.product_id.length > 0 &&
  (!('variant_id' in value) || typeof value.variant_id === 'string') &&
  typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity >= 1

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  for (const key of Object.keys(body)) if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  for (const key of REQUIRED_KEYS) if (!(key in body)) throw apiError(400, 'INVALID_INPUT', `Missing field: ${key}`)
  if (typeof body.trip_id !== 'string' || !body.trip_id) throw apiError(400, 'INVALID_INPUT', 'trip_id must be a non-empty string')
  if (!Array.isArray(body.items) || !body.items.length || !body.items.every(isItem)) throw apiError(400, 'INVALID_INPUT', 'items must be a non-empty array of { product_id, variant_id?, quantity }')
  if (typeof body.buyer_name !== 'string' || !body.buyer_name) throw apiError(400, 'INVALID_INPUT', 'buyer_name must be a non-empty string')
  if (!isEmail(body.buyer_email)) throw apiError(400, 'INVALID_INPUT', 'buyer_email must be a valid email')
  if (typeof body.buyer_phone !== 'string' || !body.buyer_phone) throw apiError(400, 'INVALID_INPUT', 'buyer_phone must be a non-empty string')
  if (typeof body.shipping_address !== 'string' || !body.shipping_address) throw apiError(400, 'INVALID_INPUT', 'shipping_address must be a non-empty string')

  const { data: trip, error: tripError } = await getOpenTrip(event, body.trip_id)
  if (tripError?.code === 'PGRST116' || !trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  const now = new Date().toISOString()
  if (trip.status !== 'open' || now < trip.order_open_at || now > trip.order_close_at) {
    throw apiError(409, 'INVALID_STATE', 'Trip is not open for orders')
  }

  const productIds = [...new Set(body.items.map((item: any) => item.product_id))]
  const { data: products, error: productsError } = await getProductsForOrder(event, body.trip_id, productIds as string[])
  if (productsError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load products')
  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]))

  const orderItems = []
  for (const item of body.items) {
    const product = productMap.get(item.product_id)
    if (!product) throw apiError(404, 'PRODUCT_NOT_FOUND', `Product ${item.product_id} not found`)
    const variants = product.product_variants ?? []
    if (variants.length > 0 && !item.variant_id) throw apiError(400, 'INVALID_INPUT', `variant_id required for product ${item.product_id}`)
    let variant = null
    if (item.variant_id) {
      variant = variants.find((v: any) => v.id === item.variant_id)
      if (!variant) throw apiError(400, 'INVALID_INPUT', `variant_id ${item.variant_id} not found for product ${item.product_id}`)
    }
    const unit_price = variant ? variant.price : product.price
    const photos = [...(product.product_photos ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
    const snapshot_photo_url = variant?.photo_url || photos[0]?.photo_url || ''
    orderItems.push({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      quantity: item.quantity,
      unit_price,
      line_total: unit_price * item.quantity,
      product_name_snapshot: product.name,
      category_snapshot: product.category ?? null,
      variant_name_snapshot: variant?.name ?? null,
      snapshot_photo_url,
    })
  }

  const user = await serverSupabaseUser(event).catch(() => null)
  const { data, error } = await insertOrder(event, {
    trip_id: body.trip_id,
    buyer_id: user?.sub ?? null,
    buyer_name: body.buyer_name,
    buyer_email: body.buyer_email,
    buyer_phone: body.buyer_phone,
    shipping_address: body.shipping_address,
    items: orderItems,
  })
  if (error || !data) { console.error('insertOrder failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create order') }

  sendEmail(body.buyer_email, 'Pesanan diterima', `Lacak pesanan Anda: /orders/track/${data.tracking_token}`)

  return { order_id: data.id, tracking_token: data.tracking_token }
})
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS

---

### Task 3: `GET /api/orders/track/:token` and `GET /api/me/orders`

**Files:**
- Create: `server/api/orders/track/[token].get.ts`
- Create: `server/api/me/orders.get.ts`

**Interfaces:**
- Consumes: `getOrderByTrackingToken`, `listOrdersForBuyer` from `../../repositories/order.repository` (Task 1); `requireUser` from `../../utils/auth`.

- [ ] **Step 1: Write the tracking endpoint**

`server/api/orders/track/[token].get.ts`:
```ts
import { apiError } from '../../../utils/api-error'
import { getOrderByTrackingToken } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const { data, error } = await getOrderByTrackingToken(event, token)
  if (error?.code === 'PGRST116' || !data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  return { order: data }
})
```

- [ ] **Step 2: Write the buyer orders list endpoint**

`server/api/me/orders.get.ts`:
```ts
import { apiError } from '../../utils/api-error'
import { requireUser } from '../../utils/auth'
import { listOrdersForBuyer } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { data, error } = await listOrdersForBuyer(event, user.id)
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orders')
  return { orders: data ?? [] }
})
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all tests, no regressions)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds with no compilation errors

---

## Verification Checklist

- [ ] `npm test` passes (all tests including new ones from Tasks 1-2)
- [ ] `npm run build` succeeds
- [ ] Manual Postman flow: create trip → open trip → create product with variant → `POST /api/orders` → `GET /api/orders/track/:token` → login as buyer → `GET /api/me/orders`
- [ ] Note in final report: `orders`, `order_items` tables must exist in Supabase schema with fields matching `PRD/DATA_MODEL.md`
