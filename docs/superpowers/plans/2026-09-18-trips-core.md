# Trips Core API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement seller trip lifecycle API — list, create, edit, open, close.

**Architecture:** Thin Nitro handlers under `server/api/seller/trips*` call a new `trip.repository.ts` (Supabase queries scoped by `jastiper_id`) via `requireSeller`. Slug generated with a small inline helper (slugify + random suffix).

**Tech Stack:** Nuxt 4 / Nitro (H3), @nuxtjs/supabase, Node built-in test runner.

## Global Constraints

- Error contract: `{ "error": { "code": "...", "message": "..." } }` via `apiError(status, code, message)` from `server/utils/api-error.ts`.
- Auth/role gate: `requireSeller(event)` from `server/utils/require-seller.ts` — allows `jastiper`/`admin`, throws on else.
- Ownership: trip queries filtered `.eq('jastiper_id', seller.id)`; not found or not owned → `404 TRIP_NOT_FOUND`.
- Invalid lifecycle transition → `409 INVALID_STATE`.
- Create/PATCH required fields (non-empty strings): `title`, `destination`, `thumbnail_url`, `order_open_at`, `order_close_at`. `description` optional. Unknown/invalid fields → `400 INVALID_INPUT`.
- Slug format: slugified title + `-` + 6-char random alphanumeric suffix, e.g. `tokyo-maret-a1b2c3`.
- No commit unless the user explicitly requests it.

---

### Task 1: Trip repository + slug helper

**Files:**
- Create: `server/repositories/trip.repository.ts`
- Test: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Produces: `generateTripSlug(title: string): string`, `listTrips(event, jastiperId)`, `insertTrip(event, jastiperId, values)`, `getOwnedTrip(event, jastiperId, tripId)`, `updateTrip(event, jastiperId, tripId, values)`, `openTrip(event, jastiperId, tripId)`, `closeTrip(event, jastiperId, tripId)`.
- Consumes: `getSupabaseAdmin(event)` from `server/utils/supabase-admin.ts` (same pattern as `server/repositories/payout-account.repository.ts`).

- [ ] **Step 1: Write the failing tests for slug + validation logic**

Append to `tests/profile-api.test.mjs`:

```js
function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function generateTripSlug(title) {
  const suffix = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
  return `${slugify(title)}-${suffix}`
}

const TRIP_REQUIRED_KEYS = ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at']
const TRIP_ALLOWED_KEYS = new Set([...TRIP_REQUIRED_KEYS, 'description'])

function validateTripCreate(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  for (const key of Object.keys(body)) if (!TRIP_ALLOWED_KEYS.has(key)) return false
  for (const key of TRIP_REQUIRED_KEYS) if (typeof body[key] !== 'string' || body[key].length === 0) return false
  if ('description' in body && typeof body.description !== 'string') return false
  return true
}

function validateTripPatch(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const keys = Object.keys(body)
  if (keys.length === 0) return false
  for (const key of keys) {
    if (!TRIP_ALLOWED_KEYS.has(key)) return false
    if (key === 'description') {
      if (typeof body[key] !== 'string') return false
      continue
    }
    if (typeof body[key] !== 'string' || body[key].length === 0) return false
  }
  return true
}

test('generateTripSlug produces slugified title + 6-char suffix', () => {
  const slug = generateTripSlug('Tokyo Maret!!')
  assert.match(slug, /^tokyo-maret-[a-z0-9]{6}$/)
})

test('validateTripCreate requires all fields, rejects unknown keys', () => {
  const valid = { title: 'Tokyo', destination: 'Tokyo', thumbnail_url: 'x', order_open_at: '2026-01-01', order_close_at: '2026-02-01' }
  assert.strictEqual(validateTripCreate(valid), true)
  assert.strictEqual(validateTripCreate({ ...valid, title: '' }), false)
  assert.strictEqual(validateTripCreate({ ...valid, extra: 'x' }), false)
  assert.strictEqual(validateTripCreate([]), false)
})

test('validateTripPatch requires at least one valid field', () => {
  assert.strictEqual(validateTripPatch({}), false)
  assert.strictEqual(validateTripPatch({ title: 'New' }), true)
  assert.strictEqual(validateTripPatch({ description: '' }), true)
  assert.strictEqual(validateTripPatch({ title: '' }), false)
  assert.strictEqual(validateTripPatch({ unknown: 'x' }), false)
})

function canOpenTrip(status) { return status === 'coming_soon' }
function canCloseTrip(status) { return status === 'open' }

test('trip lifecycle transitions are gated by current status', () => {
  assert.strictEqual(canOpenTrip('coming_soon'), true)
  assert.strictEqual(canOpenTrip('open'), false)
  assert.strictEqual(canOpenTrip('closed'), false)
  assert.strictEqual(canCloseTrip('open'), true)
  assert.strictEqual(canCloseTrip('coming_soon'), false)
  assert.strictEqual(canCloseTrip('closed'), false)
})
```

- [ ] **Step 2: Run tests, confirm new ones pass (pure functions, no prod code needed yet)**

Run: `npm test`
Expected: all tests PASS (these are self-contained pure-function tests, same inline-copy pattern as existing payout-account tests).

- [ ] **Step 3: Write `server/repositories/trip.repository.ts`**

```ts
import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const tripFields = 'id,jastiper_id,slug,title,destination,description,thumbnail_url,order_open_at,order_close_at,status,opened_at,closed_at,created_at'

type TripValues = {
  title: string
  destination: string
  description?: string
  thumbnail_url: string
  order_open_at: string
  order_close_at: string
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function generateTripSlug(title: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const suffix = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `${slugify(title)}-${suffix}`
}

export function listTrips(event: H3Event, jastiperId: string) {
  return getSupabaseAdmin(event)
    .from('trips')
    .select(tripFields)
    .eq('jastiper_id', jastiperId)
    .order('created_at', { ascending: false })
}

export function insertTrip(event: H3Event, jastiperId: string, values: TripValues) {
  return getSupabaseAdmin(event)
    .from('trips')
    .insert({
      jastiper_id: jastiperId,
      slug: generateTripSlug(values.title),
      status: 'coming_soon',
      ...values
    })
    .select(tripFields)
    .single()
}

export function getOwnedTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event)
    .from('trips')
    .select(tripFields)
    .eq('jastiper_id', jastiperId)
    .eq('id', tripId)
    .single()
}

export function updateTrip(event: H3Event, jastiperId: string, tripId: string, values: Partial<TripValues>) {
  return getSupabaseAdmin(event)
    .from('trips')
    .update(values)
    .eq('jastiper_id', jastiperId)
    .eq('id', tripId)
    .select(tripFields)
    .single()
}

export function openTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event)
    .from('trips')
    .update({ status: 'open', opened_at: new Date().toISOString() })
    .eq('jastiper_id', jastiperId)
    .eq('id', tripId)
    .select(tripFields)
    .single()
}

export function closeTrip(event: H3Event, jastiperId: string, tripId: string) {
  return getSupabaseAdmin(event)
    .from('trips')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('jastiper_id', jastiperId)
    .eq('id', tripId)
    .select(tripFields)
    .single()
}
```

- [ ] **Step 4: Run `npm run build` to confirm the repository compiles**

Run: `npm run build`
Expected: build succeeds (no route uses it yet, but TS must compile cleanly).

---

### Task 2: Seller trip endpoints

**Files:**
- Create: `server/api/seller/trips.get.ts`
- Create: `server/api/seller/trips.post.ts`
- Create: `server/api/seller/trips/[id].patch.ts`
- Create: `server/api/seller/trips/[id]/open.post.ts`
- Create: `server/api/seller/trips/[id]/close.post.ts`

**Interfaces:**
- Consumes: `requireSeller(event)` → `{ id, role }` from `server/utils/require-seller.ts`; `apiError(status, code, message)` from `server/utils/api-error.ts`; repository functions from Task 1 (`listTrips`, `insertTrip`, `getOwnedTrip`, `updateTrip`, `openTrip`, `closeTrip`).
- Trip not found or not owned: repository `.single()` on a zero-row scoped query returns Supabase error code `PGRST116` (same as `payout-account.get.ts` pattern) → map to `404 TRIP_NOT_FOUND`.

- [ ] **Step 1: `server/api/seller/trips.get.ts`**

```ts
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { listTrips } from '../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const { data, error } = await listTrips(event, seller.id)

  if (error) {
    console.error('listTrips failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trips')
  }

  return { trips: data ?? [] }
})
```

- [ ] **Step 2: `server/api/seller/trips.post.ts`**

```ts
import { readBody } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { insertTrip } from '../../repositories/trip.repository'

const REQUIRED_KEYS = ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at'] as const
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, 'description'])

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof body[key] !== 'string' || body[key].length === 0) {
      throw apiError(400, 'INVALID_INPUT', `${key} must be a non-empty string`)
    }
  }

  if ('description' in body && typeof body.description !== 'string') {
    throw apiError(400, 'INVALID_INPUT', 'description must be a string')
  }

  const { data, error } = await insertTrip(event, seller.id, {
    title: body.title,
    destination: body.destination,
    description: body.description,
    thumbnail_url: body.thumbnail_url,
    order_open_at: body.order_open_at,
    order_close_at: body.order_close_at
  })

  if (error || !data) {
    console.error('insertTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to create trip')
  }

  return { trip: data }
})
```

- [ ] **Step 3: `server/api/seller/trips/[id].patch.ts`**

```ts
import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedTrip, updateTrip } from '../../../repositories/trip.repository'

const ALLOWED_KEYS = new Set(['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at', 'description'])

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  const keys = Object.keys(body)
  if (keys.length === 0) throw apiError(400, 'INVALID_INPUT', 'At least one field is required')

  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
    if (key === 'description') {
      if (typeof body[key] !== 'string') throw apiError(400, 'INVALID_INPUT', 'description must be a string')
      continue
    }
    if (typeof body[key] !== 'string' || body[key].length === 0) {
      throw apiError(400, 'INVALID_INPUT', `${key} must be a non-empty string`)
    }
  }

  const { data: existing, error: findError } = await getOwnedTrip(event, seller.id, tripId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (findError) {
    console.error('getOwnedTrip failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!existing) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (existing.status === 'closed') throw apiError(409, 'INVALID_STATE', 'Closed trips cannot be edited')

  const { data, error } = await updateTrip(event, seller.id, tripId, body)
  if (error || !data) {
    console.error('updateTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to update trip')
  }

  return { trip: data }
})
```

- [ ] **Step 4: `server/api/seller/trips/[id]/open.post.ts`**

```ts
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { getOwnedTrip, openTrip } from '../../../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!

  const { data: existing, error: findError } = await getOwnedTrip(event, seller.id, tripId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (findError) {
    console.error('getOwnedTrip failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!existing) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (existing.status !== 'coming_soon') throw apiError(409, 'INVALID_STATE', 'Trip cannot be opened')

  const { data, error } = await openTrip(event, seller.id, tripId)
  if (error || !data) {
    console.error('openTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to open trip')
  }

  return { trip: data }
})
```

- [ ] **Step 5: `server/api/seller/trips/[id]/close.post.ts`**

```ts
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { getOwnedTrip, closeTrip } from '../../../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!

  const { data: existing, error: findError } = await getOwnedTrip(event, seller.id, tripId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (findError) {
    console.error('getOwnedTrip failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!existing) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (existing.status !== 'open') throw apiError(409, 'INVALID_STATE', 'Trip cannot be closed')

  const { data, error } = await closeTrip(event, seller.id, tripId)
  if (error || !data) {
    console.error('closeTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to close trip')
  }

  return { trip: data }
})
```

- [ ] **Step 6: Run tests and build**

Run: `npm test`
Expected: all tests PASS (including Task 1's new tests).

Run: `npm run build`
Expected: build succeeds, new route chunks generated for all 5 trip endpoints.

- [ ] **Step 7: Commit — SKIP unless the user explicitly requests a commit.**

---

## Verification Checklist

- [ ] `GET /api/seller/trips` returns only the caller's trips
- [ ] `POST /api/seller/trips` rejects missing/empty required fields and unknown keys; creates `coming_soon` trip with generated slug
- [ ] `PATCH /api/seller/trips/:id` rejects empty body, unknown keys, empty required-field values; 404 on foreign/missing trip; 409 on closed trip
- [ ] `POST /api/seller/trips/:id/open` transitions `coming_soon` → `open` only; 409 otherwise
- [ ] `POST /api/seller/trips/:id/close` transitions `open` → `closed` only; 409 otherwise
- [ ] `npm test` and `npm run build` both pass
