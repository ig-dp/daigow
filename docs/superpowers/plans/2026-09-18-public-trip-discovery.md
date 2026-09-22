# Public Trip Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public GET trip-by-slug (nested products) + POST subscribe (idempotent, coming_soon only).

**Architecture:** Thin public handlers → `trip-public.repository.ts` (service-role Supabase queries). Same error contract and patterns as existing seller endpoints.

**Tech Stack:** Nuxt 4 / Nitro (H3), @nuxtjs/supabase, Node built-in test runner.

## Global Constraints

- Error contract: `apiError(status, code, message)` from `server/utils/api-error.ts`.
- Public endpoints: no auth checks.
- GET by-slug: nested select `*, products(*, product_photos(*), product_variants(*))`; `coming_soon` returns `products: []`.
- Subscribe: valid non-empty email format; trip must be `coming_soon` else `409 INVALID_STATE`; upsert on `(trip_id,email)` unique; idempotent.
- Not-found → `404 TRIP_NOT_FOUND`.
- No commit unless explicitly requested.

---

### Task 1: Repository + tests

**Files:**
- Create: `server/repositories/trip-public.repository.ts`
- Modify: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Produces: `getTripBySlug(event: H3Event, slug: string)`, `insertSubscriber(event: H3Event, tripId: string, email: string)`.
- Consumes: `getSupabaseAdmin(event)` from `server/utils/supabase-admin.ts`.

- [ ] **Step 1: Append failing tests to `tests/profile-api.test.mjs`**

```js
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function canSubscribe(status) {
  return status === 'coming_soon'
}

test('subscribe email validation accepts well-formed emails only', () => {
  assert.strictEqual(isValidEmail('buyer@example.com'), true)
  assert.strictEqual(isValidEmail('a@b.co'), true)
  assert.strictEqual(isValidEmail(''), false)
  assert.strictEqual(isValidEmail('no-at-sign'), false)
  assert.strictEqual(isValidEmail('a b@c.com'), false)
  assert.strictEqual(isValidEmail(123), false)
})

test('subscribe allowed only while trip is coming_soon', () => {
  assert.strictEqual(canSubscribe('coming_soon'), true)
  assert.strictEqual(canSubscribe('open'), false)
  assert.strictEqual(canSubscribe('closed'), false)
})
```

- [ ] **Step 2: Run `npm test` — expect all PASS (pure functions)**

- [ ] **Step 3: Write `server/repositories/trip-public.repository.ts`**

```ts
import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const tripWithProductsFields = `
  id,jastiper_id,slug,title,destination,description,thumbnail_url,order_open_at,order_close_at,status,opened_at,closed_at,created_at,
  products (
    id,trip_id,name,category,description,description_source,price,created_at,
    product_photos ( id,product_id,photo_url,sort_order ),
    product_variants ( id,product_id,name,photo_url,price )
  )
`

export function getTripBySlug(event: H3Event, slug: string) {
  return getSupabaseAdmin(event).from('trips').select(tripWithProductsFields).eq('slug', slug).single()
}

export function insertSubscriber(event: H3Event, tripId: string, email: string) {
  return getSupabaseAdmin(event)
    .from('trip_subscribers')
    .upsert({ trip_id: tripId, email }, { onConflict: 'trip_id,email' })
    .select('id,trip_id,email,notified_at,created_at')
    .single()
}
```

---

### Task 2: Public endpoints

**Files:**
- Create: `server/api/trips/by-slug/[slug].get.ts`
- Create: `server/api/trips/[id]/subscribe.post.ts`

**Interfaces:**
- Consumes: `getTripBySlug`, `insertSubscriber` from Task 1; `apiError` from `server/utils/api-error.ts`.
- `PGRST116` on by-slug → `404 TRIP_NOT_FOUND` (same pattern as payout-account GET).

- [ ] **Step 1: `server/api/trips/by-slug/[slug].get.ts`**

```ts
import type { H3Event } from 'h3'
import { apiError } from '../../../utils/api-error'
import { getTripBySlug } from '../../../repositories/trip-public.repository'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const { data, error } = await getTripBySlug(event, slug)

  if (error?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (error) {
    console.error('getTripBySlug failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!data) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')

  if (data.status === 'coming_soon') {
    return { trip: { ...data, products: [] } }
  }

  return { trip: data }
})
```

- [ ] **Step 2: `server/api/trips/[id]/subscribe.post.ts`**

```ts
import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { insertSubscriber } from '../../../repositories/trip-public.repository'
import { getSupabaseAdmin } from '../../../utils/supabase-admin'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email)) {
    throw apiError(400, 'INVALID_INPUT', 'email must be a valid email address')
  }

  const admin = getSupabaseAdmin(event)
  const { data: trip, error: tripError } = await admin
    .from('trips')
    .select('id,status')
    .eq('id', tripId)
    .single()

  if (tripError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) {
    console.error('subscribe trip lookup failed:', tripError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')

  if (trip.status !== 'coming_soon') {
    throw apiError(409, 'INVALID_STATE', 'Trip is not accepting subscribers')
  }

  const { data, error } = await insertSubscriber(event, tripId, body.email)
  if (error || !data) {
    console.error('insertSubscriber failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to subscribe')
  }

  return { subscriber: data }
})
```

- [ ] **Step 3: Run `npm test` and `npm run build`**

Expected: tests PASS; build generates route chunks for `trips/by-slug/[slug].get` and `trips/[id]/subscribe.post`.

- [ ] **Step 4: SKIP commit unless user requests.**

---

## Verification Checklist

- [ ] `GET /api/trips/by-slug/:slug` returns trip with products for open/closed; empty products for coming_soon; 404 for unknown slug
- [ ] `POST /api/trips/:id/subscribe` rejects invalid email; 404 unknown trip; 409 when trip not coming_soon; idempotent on repeat email
- [ ] `npm test` and `npm run build` pass
