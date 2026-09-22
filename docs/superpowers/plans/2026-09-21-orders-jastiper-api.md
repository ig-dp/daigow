# Orders Jastiper API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seller order management APIs: list, detail, confirm, reject, cancel item (with refund), ship, mark-delivered.

**Architecture:** Thin Nitro handlers validate input/state; `order.repository.ts` (extended) performs service-role queries, direct sequential writes for cancel/refund (no DB transaction yet).

**Tech Stack:** Nuxt 4 / Nitro (H3), @nuxtjs/supabase, Node built-in test runner.

## Global Constraints

- All error responses use `{ error: { code, message } }` via `apiError`.
- Ownership: `orders -> trips.jastiper_id`, or `order_items -> orders -> trips.jastiper_id`.
- Non-owned/missing resource → `404 ORDER_NOT_FOUND` / `404 ORDER_ITEM_NOT_FOUND`.
- Wrong current status → `409 INVALID_STATE`.
- Refund rows: `status='pending_transfer'`, `channel_fee_refunded=0`.
- Email via existing `sendEmail` stub (`server/utils/mailer.ts`); never fails the request.
- No commit unless explicitly requested.
- Tests: inlined pure functions appended to `tests/profile-api.test.mjs`, matching existing pattern.

---

### Task 1: Repository functions for seller order management

**Files:**
- Modify: `server/repositories/order.repository.ts` (append)
- Test: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Produces:
  - `listSellerOrders(event, jastiperId: string, filters: { trip_id?: string; status?: string }): PromiseLike<{ data, error }>`
  - `getOwnedOrder(event, jastiperId: string, orderId: string): PromiseLike<{ data, error }>`
  - `updateOrderStatus(event, orderId: string, values: Record<string, unknown>): PromiseLike<{ data, error }>`
  - `getOwnedOrderItem(event, jastiperId: string, orderItemId: string): PromiseLike<{ data, error }>` — returns item joined with its order (`order_id`, `order_status`, `line_total`) and ownership check.
  - `updateOrderItemStatus(event, orderItemId: string, values: Record<string, unknown>): PromiseLike<{ data, error }>`
  - `countActiveOrderItems(event, orderId: string, excludeItemId: string): Promise<{ data: number; error }>`
  - `insertRefund(event, values: { order_id: string; order_item_id: string | null; refund_type: string; item_amount_refunded: number; platform_fee_refunded: number; total_refund_amount: number }): PromiseLike<{ data, error }>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/profile-api.test.mjs`:

```js
function canConfirm(status) { return status === 'awaiting_confirmation' }
function canReject(status) { return status === 'awaiting_confirmation' }
function canCancelItem(orderStatus) { return orderStatus === 'processing' }
function canShip(status) { return status === 'processing' }
function canMarkDelivered(status) { return status === 'shipped' }

test('order status gates for seller transitions', () => {
  assert.strictEqual(canConfirm('awaiting_confirmation'), true)
  assert.strictEqual(canConfirm('processing'), false)
  assert.strictEqual(canReject('awaiting_confirmation'), true)
  assert.strictEqual(canCancelItem('processing'), true)
  assert.strictEqual(canCancelItem('shipped'), false)
  assert.strictEqual(canShip('processing'), true)
  assert.strictEqual(canShip('awaiting_payment'), false)
  assert.strictEqual(canMarkDelivered('shipped'), true)
  assert.strictEqual(canMarkDelivered('delivered'), false)
})

function isValidRejectBody(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body) &&
    typeof body.reason === 'string' && body.reason.length > 0
}

test('reject requires non-empty reason', () => {
  assert.strictEqual(isValidRejectBody({ reason: 'Out of stock' }), true)
  assert.strictEqual(isValidRejectBody({ reason: '' }), false)
  assert.strictEqual(isValidRejectBody({}), false)
})

function isValidShipBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const hasEvidence = typeof body.shipping_evidence_url === 'string' && body.shipping_evidence_url.length > 0
  const hasTracking = typeof body.tracking_number === 'string' && body.tracking_number.length > 0
  return hasEvidence || hasTracking
}

test('ship requires at least one of evidence url or tracking number', () => {
  assert.strictEqual(isValidShipBody({ shipping_evidence_url: 'http://x' }), true)
  assert.strictEqual(isValidShipBody({ tracking_number: 'JX123' }), true)
  assert.strictEqual(isValidShipBody({}), false)
  assert.strictEqual(isValidShipBody({ shipping_evidence_url: '' }), false)
})

function computeCancelRefund(item, remainingActiveCount, orderPlatformFee) {
  if (remainingActiveCount > 0) {
    return { refund_type: 'partial_item', item_amount_refunded: item.line_total, platform_fee_refunded: 0, total_refund_amount: item.line_total, orderCancelled: false }
  }
  const total = item.line_total + orderPlatformFee
  return { refund_type: 'full_order', item_amount_refunded: item.line_total, platform_fee_refunded: orderPlatformFee, total_refund_amount: total, orderCancelled: true }
}

test('cancel item computes partial refund when other active items remain', () => {
  const result = computeCancelRefund({ line_total: 50000 }, 1, 3000)
  assert.strictEqual(result.refund_type, 'partial_item')
  assert.strictEqual(result.item_amount_refunded, 50000)
  assert.strictEqual(result.platform_fee_refunded, 0)
  assert.strictEqual(result.orderCancelled, false)
})

test('cancel item computes full order refund when last active item', () => {
  const result = computeCancelRefund({ line_total: 50000 }, 0, 3000)
  assert.strictEqual(result.refund_type, 'full_order')
  assert.strictEqual(result.item_amount_refunded, 50000)
  assert.strictEqual(result.platform_fee_refunded, 3000)
  assert.strictEqual(result.total_refund_amount, 53000)
  assert.strictEqual(result.orderCancelled, true)
})
```

- [ ] **Step 2: Run tests to verify pure logic tests pass**

Run: `npm test`
Expected: PASS (pure functions, no repository call yet — confirms no syntax errors before Step 3)

- [ ] **Step 3: Append repository functions**

Append to `server/repositories/order.repository.ts`:

```ts
export function listSellerOrders(event: H3Event, jastiperId: string, filters: { trip_id?: string; status?: string }) {
  let query = getSupabaseAdmin(event).from('orders').select(`${orderFields},trips!inner(jastiper_id)`).eq('trips.jastiper_id', jastiperId).order('created_at', { ascending: false })
  if (filters.trip_id) query = query.eq('trip_id', filters.trip_id)
  if (filters.status) query = query.eq('status', filters.status)
  return query
}

export function getOwnedOrder(event: H3Event, jastiperId: string, orderId: string) {
  return getSupabaseAdmin(event).from('orders').select(`${orderFields},trips!inner(jastiper_id)`).eq('id', orderId).eq('trips.jastiper_id', jastiperId).single()
}

export function updateOrderStatus(event: H3Event, orderId: string, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('orders').update(values).eq('id', orderId).select(orderFields).single()
}

export function getOwnedOrderItem(event: H3Event, jastiperId: string, orderItemId: string) {
  return getSupabaseAdmin(event)
    .from('order_items')
    .select('id,order_id,line_total,item_status,orders!inner(id,status,platform_fee_amount,trip_id,trips!inner(jastiper_id))')
    .eq('id', orderItemId)
    .eq('orders.trips.jastiper_id', jastiperId)
    .single()
}

export function updateOrderItemStatus(event: H3Event, orderItemId: string, values: Record<string, unknown>) {
  return getSupabaseAdmin(event).from('order_items').update(values).eq('id', orderItemId).select('id,order_id,item_status').single()
}

export async function countActiveOrderItems(event: H3Event, orderId: string, excludeItemId: string) {
  const { count, error } = await getSupabaseAdmin(event).from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId).eq('item_status', 'active').neq('id', excludeItemId)
  return { data: count ?? 0, error }
}

export function insertRefund(event: H3Event, values: { order_id: string; order_item_id: string | null; refund_type: string; item_amount_refunded: number; platform_fee_refunded: number; total_refund_amount: number }) {
  return getSupabaseAdmin(event).from('refunds').insert({ ...values, channel_fee_refunded: 0, status: 'pending_transfer' }).select('id').single()
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS

---

### Task 2: List and detail endpoints

**Files:**
- Create: `server/api/seller/orders.get.ts`
- Create: `server/api/seller/orders/[id].get.ts`

**Interfaces:**
- Consumes: `listSellerOrders`, `getOwnedOrder` from `../../repositories/order.repository` (Task 1); `requireSeller` from `../../utils/require-seller`; `apiError` from `../../utils/api-error`.

- [ ] **Step 1: Write list endpoint**

`server/api/seller/orders.get.ts`:
```ts
import { getQuery } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { listSellerOrders } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const query = getQuery(event)
  const trip_id = typeof query.trip_id === 'string' ? query.trip_id : undefined
  const status = typeof query.status === 'string' ? query.status : undefined
  const { data, error } = await listSellerOrders(event, seller.id, { trip_id, status })
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orders')
  return { orders: data ?? [] }
})
```

- [ ] **Step 2: Write detail endpoint**

`server/api/seller/orders/[id].get.ts`:
```ts
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedOrder } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const { data, error } = await getOwnedOrder(event, seller.id, orderId)
  if (error?.code === 'PGRST116' || !data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  return { order: data }
})
```

- [ ] **Step 3: Run tests and build**

Run: `npm test`
Expected: PASS (no new tests this task — pure passthrough handlers)

---

### Task 3: Confirm, reject, ship, mark-delivered endpoints

**Files:**
- Create: `server/api/seller/orders/[id]/confirm.post.ts`
- Create: `server/api/seller/orders/[id]/reject.post.ts`
- Create: `server/api/seller/orders/[id]/ship.post.ts`
- Create: `server/api/seller/orders/[id]/mark-delivered.post.ts`

**Interfaces:**
- Consumes: `getOwnedOrder`, `updateOrderStatus` from `../../../../repositories/order.repository` (Task 1); `sendEmail` from `../../../../utils/mailer`; `apiError`; `requireSeller`.

- [ ] **Step 1: Write confirm endpoint**

`server/api/seller/orders/[id]/confirm.post.ts`:
```ts
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'awaiting_confirmation') throw apiError(409, 'INVALID_STATE', 'Order is not awaiting confirmation')

  const now = new Date()
  const payment_deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'awaiting_payment', confirmed_at: now.toISOString(), payment_deadline })
  if (error || !data) { console.error('confirm order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to confirm order') }

  sendEmail(order.buyer_email, 'Pesanan dikonfirmasi', 'Silakan lakukan pembayaran.')
  return { order: data }
})
```

- [ ] **Step 2: Write reject endpoint**

`server/api/seller/orders/[id]/reject.post.ts`:
```ts
import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.reason !== 'string' || !body.reason) {
    throw apiError(400, 'INVALID_INPUT', 'reason must be a non-empty string')
  }

  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'awaiting_confirmation') throw apiError(409, 'INVALID_STATE', 'Order is not awaiting confirmation')

  const { data, error } = await updateOrderStatus(event, orderId, { status: 'cancelled', cancellation_reason: body.reason, cancelled_by: 'jastiper', settled_at: new Date().toISOString() })
  if (error || !data) { console.error('reject order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to reject order') }

  sendEmail(order.buyer_email, 'Pesanan ditolak', `Alasan: ${body.reason}`)
  return { order: data }
})
```

- [ ] **Step 3: Write ship endpoint**

`server/api/seller/orders/[id]/ship.post.ts`:
```ts
import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  const hasEvidence = typeof body.shipping_evidence_url === 'string' && body.shipping_evidence_url.length > 0
  const hasTracking = typeof body.tracking_number === 'string' && body.tracking_number.length > 0
  if (!hasEvidence && !hasTracking) throw apiError(400, 'INVALID_INPUT', 'shipping_evidence_url or tracking_number is required')

  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'processing') throw apiError(409, 'INVALID_STATE', 'Order is not processing')

  const { data, error } = await updateOrderStatus(event, orderId, {
    status: 'shipped',
    shipping_evidence_url: hasEvidence ? body.shipping_evidence_url : null,
    tracking_number: hasTracking ? body.tracking_number : null,
    shipped_at: new Date().toISOString(),
  })
  if (error || !data) { console.error('ship order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to ship order') }

  sendEmail(order.buyer_email, 'Pesanan dikirim', 'Pesanan Anda sedang dalam perjalanan.')
  return { order: data }
})
```

- [ ] **Step 4: Write mark-delivered endpoint**

`server/api/seller/orders/[id]/mark-delivered.post.ts`:
```ts
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'shipped') throw apiError(409, 'INVALID_STATE', 'Order is not shipped')

  const now = new Date()
  const auto_complete_at = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'delivered', delivered_by: 'jastiper', delivered_at: now.toISOString(), auto_complete_at })
  if (error || !data) { console.error('mark-delivered failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to mark order delivered') }

  sendEmail(order.buyer_email, 'Pesanan terkirim', 'Konfirmasi penerimaan atau laporkan masalah.')
  return { order: data }
})
```

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS, build succeeds

---

### Task 4: Cancel order item endpoint (with refund)

**Files:**
- Create: `server/api/seller/order-items/[id]/cancel.post.ts`

**Interfaces:**
- Consumes: `getOwnedOrderItem`, `updateOrderItemStatus`, `countActiveOrderItems`, `updateOrderStatus`, `insertRefund` from `../../../../repositories/order.repository` (Task 1); `sendEmail`; `apiError`; `requireSeller`.

- [ ] **Step 1: Write cancel endpoint**

`server/api/seller/order-items/[id]/cancel.post.ts`:
```ts
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrderItem, updateOrderItemStatus, countActiveOrderItems, updateOrderStatus, insertRefund } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const itemId = getRouterParam(event, 'id')!

  const { data: item, error: findError } = await getOwnedOrderItem(event, seller.id, itemId)
  if (findError?.code === 'PGRST116' || !item) throw apiError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order item')
  const order = (item as any).orders
  if (order.status !== 'processing') throw apiError(409, 'INVALID_STATE', 'Order is not processing')
  if (item.item_status === 'cancelled') throw apiError(409, 'INVALID_STATE', 'Item already cancelled')

  const { error: cancelError } = await updateOrderItemStatus(event, itemId, { item_status: 'cancelled', cancelled_at: new Date().toISOString() })
  if (cancelError) { console.error('cancel item failed:', cancelError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel item') }

  const { data: remainingActive, error: countError } = await countActiveOrderItems(event, item.order_id, itemId)
  if (countError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to check remaining items')

  if (remainingActive > 0) {
    const { error: refundError } = await insertRefund(event, {
      order_id: item.order_id,
      order_item_id: itemId,
      refund_type: 'partial_item',
      item_amount_refunded: item.line_total,
      platform_fee_refunded: 0,
      total_refund_amount: item.line_total,
    })
    if (refundError) { console.error('insert partial refund failed:', refundError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create refund') }
  } else {
    const total_refund_amount = item.line_total + order.platform_fee_amount
    const { error: refundError } = await insertRefund(event, {
      order_id: item.order_id,
      order_item_id: itemId,
      refund_type: 'full_order',
      item_amount_refunded: item.line_total,
      platform_fee_refunded: order.platform_fee_amount,
      total_refund_amount,
    })
    if (refundError) { console.error('insert full-order refund failed:', refundError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create refund') }

    const { error: orderError } = await updateOrderStatus(event, item.order_id, { status: 'cancelled', cancelled_by: 'jastiper', settled_at: new Date().toISOString() })
    if (orderError) { console.error('cancel order failed:', orderError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel order') }
  }

  sendEmail('buyer', 'Item pesanan dibatalkan', `Item ${itemId} dibatalkan, refund akan diproses.`)
  return { success: true }
})
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS (all tests including Task 1's cancel-refund computation tests)

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no compilation errors

---

## Verification Checklist

- [ ] `npm test` passes (all tests)
- [ ] `npm run build` succeeds
- [ ] Manual Postman flow: create order → seller confirm → seller ship → seller mark-delivered
- [ ] Manual Postman flow: create order with 2 items → seller confirm → (simulate payment→processing manually in DB) → cancel one item (partial refund, order stays processing) → cancel last item (full_order refund, order cancelled)
- [ ] Note in final report: `refunds` table must exist in Supabase schema matching `PRD/DATA_MODEL.md`; `order.status` must reach `processing` via a manual DB update for now (payment webhook not yet built)
