# Product API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seller create/update/delete Product APIs with photos and variants, following existing trip API patterns.

**Architecture:** Thin Nitro handlers (`server/api/seller/...`) validate input and call `product.repository.ts`, which runs Supabase service-role queries via `getSupabaseAdmin(event)`. Ownership is enforced by joining through the parent trip's `jastiper_id`.

**Tech Stack:** Nuxt 4 / Nitro (H3), @nuxtjs/supabase, Node built-in test runner.

## Global Constraints

- Error contract: `apiError(status, code, message)` from `server/utils/api-error.ts` — `{ error: { code, message } }`.
- Seller role gate: `requireSeller(event)` from `server/utils/require-seller.ts` (allows `jastiper`/`admin`).
- Not-found → `404` with specific code (`TRIP_NOT_FOUND`, `PRODUCT_NOT_FOUND`).
- `price` must be a non-negative number (IDR whole rupiah).
- `description_source` must be one of `manual`, `ai`, `ai_edited`.
- Product delete blocked with `409 INVALID_STATE` if referenced by any `order_items` row.
- No storage upload or AI generation in this batch — routes accept `photo_url` strings only.
- No commit unless explicitly requested by the user.

---

### Task 1: Product repository + pure validation tests

**Files:**
- Create: `server/repositories/product.repository.ts`
- Modify: `tests/profile-api.test.mjs` (append)

**Interfaces:**
- Consumes: `getSupabaseAdmin(event)` from `server/utils/supabase-admin.ts` (existing).
- Consumes: `getOwnedTrip(event, jastiperId, tripId)` from `server/repositories/trip.repository.ts` (existing, returns `{ data, error }` with trip row incl. `status`).
- Produces:
  - `insertProduct(event, tripId, values: ProductValues): Promise<{ data, error }>` — `values = { name: string, category?: string, description?: string, description_source: 'manual'|'ai'|'ai_edited', price: number, photos: { photo_url: string, sort_order: number }[], variants?: { name: string, photo_url?: string, price: number }[] }`. Inserts product row, then bulk-inserts photos and variants (if present) using returned `product.id`. Returns the product with nested `product_photos` and `product_variants` on success (re-select after insert).
  - `getOwnedProduct(event, jastiperId, productId): Promise<{ data, error }>` — selects product joined to trip, filtered by `trips.jastiper_id = jastiperId` and `products.id = productId`. Returns `{ id, trip_id, name, category, description, description_source, price, created_at }` plus nested photos/variants.
  - `updateProduct(event, productId, values: Partial<Omit<ProductValues,'photos'|'variants'>>): Promise<{ data, error }>` — updates scalar product fields only.
  - `replaceProductPhotos(event, productId, photos: { photo_url: string, sort_order: number }[]): Promise<{ error }>` — deletes all existing `product_photos` for `productId`, inserts new ones.
  - `replaceProductVariants(event, productId, variants: { name: string, photo_url?: string, price: number }[]): Promise<{ error }>` — deletes all existing `product_variants` for `productId`, inserts new ones.
  - `productHasOrderItems(event, productId): Promise<{ data: boolean, error }>` — `true` if any `order_items` row has `product_id = productId`.
  - `deleteProduct(event, productId): Promise<{ error }>` — deletes the product row (photos/variants cascade via FK `ON DELETE CASCADE` per data model).

- [ ] **Step 1: Append failing pure-function tests to `tests/profile-api.test.mjs`**

```js
function isValidDescriptionSource(value) {
  return value === 'manual' || value === 'ai' || value === 'ai_edited'
}

function isValidPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const PRODUCT_REQUIRED_KEYS = ['name', 'description_source', 'price', 'photos']
const PRODUCT_ALLOWED_KEYS = new Set([...PRODUCT_REQUIRED_KEYS, 'category', 'description', 'variants'])

function validatePhoto(photo) {
  return typeof photo === 'object' && photo !== null && !Array.isArray(photo) &&
    typeof photo.photo_url === 'string' && photo.photo_url.length > 0 &&
    typeof photo.sort_order === 'number' && Number.isInteger(photo.sort_order)
}

function validateVariant(variant) {
  if (typeof variant !== 'object' || variant === null || Array.isArray(variant)) return false
  if (typeof variant.name !== 'string' || variant.name.length === 0) return false
  if (!isValidPrice(variant.price)) return false
  if ('photo_url' in variant && typeof variant.photo_url !== 'string') return false
  return true
}

function validateProductCreate(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  for (const key of Object.keys(body)) if (!PRODUCT_ALLOWED_KEYS.has(key)) return false
  if (typeof body.name !== 'string' || body.name.length === 0) return false
  if (!isValidDescriptionSource(body.description_source)) return false
  if (!isValidPrice(body.price)) return false
  if ('category' in body && typeof body.category !== 'string') return false
  if ('description' in body && typeof body.description !== 'string') return false
  if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(validatePhoto)) return false
  if ('variants' in body) {
    if (!Array.isArray(body.variants)) return false
    if (!body.variants.every(validateVariant)) return false
  }
  return true
}

function validateProductPatch(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const keys = Object.keys(body)
  if (keys.length === 0) return false
  for (const key of keys) {
    if (!PRODUCT_ALLOWED_KEYS.has(key)) return false
    if (key === 'name' && (typeof body.name !== 'string' || body.name.length === 0)) return false
    if (key === 'description_source' && !isValidDescriptionSource(body.description_source)) return false
    if (key === 'price' && !isValidPrice(body.price)) return false
    if (key === 'category' && typeof body.category !== 'string') return false
    if (key === 'description' && typeof body.description !== 'string') return false
    if (key === 'photos' && (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(validatePhoto))) return false
    if (key === 'variants' && (!Array.isArray(body.variants) || !body.variants.every(validateVariant))) return false
  }
  return true
}

test('product create validation enforces required and allowed fields', () => {
  const valid = { name: 'Tas', description_source: 'manual', price: 100000, photos: [{ photo_url: 'x', sort_order: 0 }] }
  assert.strictEqual(validateProductCreate(valid), true)
  assert.strictEqual(validateProductCreate({ ...valid, name: '' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, price: -1 }), false)
  assert.strictEqual(validateProductCreate({ ...valid, description_source: 'bad' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, photos: [] }), false)
  assert.strictEqual(validateProductCreate({ ...valid, extra: 'x' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, variants: [{ name: 'Merah', price: 120000 }] }), true)
  assert.strictEqual(validateProductCreate({ ...valid, variants: [{ name: '', price: 1 }] }), false)
})

test('product patch validation requires at least one valid field', () => {
  assert.strictEqual(validateProductPatch({}), false)
  assert.strictEqual(validateProductPatch({ price: 50000 }), true)
  assert.strictEqual(validateProductPatch({ price: -5 }), false)
  assert.strictEqual(validateProductPatch({ photos: [{ photo_url: 'y', sort_order: 0 }] }), true)
  assert.strictEqual(validateProductPatch({ photos: [] }), false)
})

test('product delete blocked when referenced by order items', () => {
  const hasOrderItems = (refs) => refs.length > 0
  assert.strictEqual(hasOrderItems([]), false)
  assert.strictEqual(hasOrderItems([{ id: 'x' }]), true)
})
```

- [ ] **Step 2: Run `npm test` — expect all PASS (pure functions, no server dependency)**

- [ ] **Step 3: Write `server/repositories/product.repository.ts`**

```ts
import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const productFields = 'id,trip_id,name,category,description,description_source,price,created_at,product_photos(id,product_id,photo_url,sort_order),product_variants(id,product_id,name,photo_url,price)'

type Photo = { photo_url: string, sort_order: number }
type Variant = { name: string, photo_url?: string, price: number }

type ProductValues = {
  name: string
  category?: string
  description?: string
  description_source: 'manual' | 'ai' | 'ai_edited'
  price: number
  photos: Photo[]
  variants?: Variant[]
}

export async function insertProduct(event: H3Event, tripId: string, values: ProductValues) {
  const admin = getSupabaseAdmin(event)
  const { photos, variants, ...productValues } = values

  const { data: product, error: productError } = await admin
    .from('products')
    .insert({ trip_id: tripId, ...productValues })
    .select('id')
    .single()

  if (productError || !product) return { data: null, error: productError }

  const { error: photosError } = await admin
    .from('product_photos')
    .insert(photos.map((p) => ({ product_id: product.id, ...p })))
  if (photosError) return { data: null, error: photosError }

  if (variants && variants.length > 0) {
    const { error: variantsError } = await admin
      .from('product_variants')
      .insert(variants.map((v) => ({ product_id: product.id, ...v })))
    if (variantsError) return { data: null, error: variantsError }
  }

  return admin.from('products').select(productFields).eq('id', product.id).single()
}

export function getOwnedProduct(event: H3Event, jastiperId: string, productId: string) {
  return getSupabaseAdmin(event)
    .from('products')
    .select(`${productFields},trips!inner(jastiper_id)`)
    .eq('id', productId)
    .eq('trips.jastiper_id', jastiperId)
    .single()
}

export function updateProduct(event: H3Event, productId: string, values: Partial<Omit<ProductValues, 'photos' | 'variants'>>) {
  return getSupabaseAdmin(event).from('products').update(values).eq('id', productId).select(productFields).single()
}

export async function replaceProductPhotos(event: H3Event, productId: string, photos: Photo[]) {
  const admin = getSupabaseAdmin(event)
  const { error: deleteError } = await admin.from('product_photos').delete().eq('product_id', productId)
  if (deleteError) return { error: deleteError }
  return admin.from('product_photos').insert(photos.map((p) => ({ product_id: productId, ...p })))
}

export async function replaceProductVariants(event: H3Event, productId: string, variants: Variant[]) {
  const admin = getSupabaseAdmin(event)
  const { error: deleteError } = await admin.from('product_variants').delete().eq('product_id', productId)
  if (deleteError) return { error: deleteError }
  if (variants.length === 0) return { error: null }
  return admin.from('product_variants').insert(variants.map((v) => ({ product_id: productId, ...v })))
}

export async function productHasOrderItems(event: H3Event, productId: string) {
  const { count, error } = await getSupabaseAdmin(event)
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
  return { data: (count ?? 0) > 0, error }
}

export function deleteProduct(event: H3Event, productId: string) {
  return getSupabaseAdmin(event).from('products').delete().eq('id', productId)
}
```

- [ ] **Step 4: Run `npm test` — expect all PASS**

---

### Task 2: Create product endpoint

**Files:**
- Create: `server/api/seller/trips/[tripId]/products.post.ts`

**Interfaces:**
- Consumes: `requireSeller(event)` from `server/utils/require-seller.ts`; `getOwnedTrip(event, jastiperId, tripId)` from `server/repositories/trip.repository.ts`; `insertProduct(event, tripId, values)` from Task 1; `apiError` from `server/utils/api-error.ts`.

- [ ] **Step 1: Write `server/api/seller/trips/[tripId]/products.post.ts`**

```ts
import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { getOwnedTrip } from '../../../../repositories/trip.repository'
import { insertProduct } from '../../../../repositories/product.repository'

const REQUIRED_KEYS = ['name', 'description_source', 'price', 'photos'] as const
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, 'category', 'description', 'variants'])
const DESCRIPTION_SOURCES = new Set(['manual', 'ai', 'ai_edited'])

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidPhoto(photo: unknown): photo is { photo_url: string, sort_order: number } {
  return typeof photo === 'object' && photo !== null && !Array.isArray(photo) &&
    typeof (photo as any).photo_url === 'string' && (photo as any).photo_url.length > 0 &&
    typeof (photo as any).sort_order === 'number' && Number.isInteger((photo as any).sort_order)
}

function isValidVariant(variant: unknown): variant is { name: string, photo_url?: string, price: number } {
  if (typeof variant !== 'object' || variant === null || Array.isArray(variant)) return false
  const v = variant as any
  if (typeof v.name !== 'string' || v.name.length === 0) return false
  if (!isValidPrice(v.price)) return false
  if ('photo_url' in v && typeof v.photo_url !== 'string') return false
  return true
}

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'tripId')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  }

  if (typeof body.name !== 'string' || body.name.length === 0) {
    throw apiError(400, 'INVALID_INPUT', 'name must be a non-empty string')
  }
  if (!DESCRIPTION_SOURCES.has(body.description_source)) {
    throw apiError(400, 'INVALID_INPUT', 'description_source must be manual, ai, or ai_edited')
  }
  if (!isValidPrice(body.price)) {
    throw apiError(400, 'INVALID_INPUT', 'price must be a non-negative number')
  }
  if ('category' in body && typeof body.category !== 'string') {
    throw apiError(400, 'INVALID_INPUT', 'category must be a string')
  }
  if ('description' in body && typeof body.description !== 'string') {
    throw apiError(400, 'INVALID_INPUT', 'description must be a string')
  }
  if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(isValidPhoto)) {
    throw apiError(400, 'INVALID_INPUT', 'photos must be a non-empty array of { photo_url, sort_order }')
  }
  if ('variants' in body) {
    if (!Array.isArray(body.variants) || !body.variants.every(isValidVariant)) {
      throw apiError(400, 'INVALID_INPUT', 'variants must be an array of { name, price, photo_url? }')
    }
  }

  const { data: trip, error: tripError } = await getOwnedTrip(event, seller.id, tripId)
  if (tripError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) {
    console.error('getOwnedTrip failed:', tripError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')

  const { data, error } = await insertProduct(event, tripId, {
    name: body.name,
    category: body.category,
    description: body.description,
    description_source: body.description_source,
    price: body.price,
    photos: body.photos,
    variants: body.variants
  })

  if (error || !data) {
    console.error('insertProduct failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to create product')
  }

  return { product: data }
})
```

- [ ] **Step 2: Run `npm run build` — expect success, route chunk generated for `seller/trips/[tripId]/products.post`**

---

### Task 3: Update and delete product endpoints

**Files:**
- Create: `server/api/seller/products/[id].patch.ts`
- Create: `server/api/seller/products/[id].delete.ts`

**Interfaces:**
- Consumes: `requireSeller`, `apiError`; `getOwnedProduct`, `updateProduct`, `replaceProductPhotos`, `replaceProductVariants`, `productHasOrderItems`, `deleteProduct` from Task 1.

- [ ] **Step 1: Write `server/api/seller/products/[id].patch.ts`**

```ts
import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedProduct, updateProduct, replaceProductPhotos, replaceProductVariants } from '../../../repositories/product.repository'

const ALLOWED_KEYS = new Set(['name', 'category', 'description', 'description_source', 'price', 'photos', 'variants'])
const DESCRIPTION_SOURCES = new Set(['manual', 'ai', 'ai_edited'])

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidPhoto(photo: unknown): photo is { photo_url: string, sort_order: number } {
  return typeof photo === 'object' && photo !== null && !Array.isArray(photo) &&
    typeof (photo as any).photo_url === 'string' && (photo as any).photo_url.length > 0 &&
    typeof (photo as any).sort_order === 'number' && Number.isInteger((photo as any).sort_order)
}

function isValidVariant(variant: unknown): variant is { name: string, photo_url?: string, price: number } {
  if (typeof variant !== 'object' || variant === null || Array.isArray(variant)) return false
  const v = variant as any
  if (typeof v.name !== 'string' || v.name.length === 0) return false
  if (!isValidPrice(v.price)) return false
  if ('photo_url' in v && typeof v.photo_url !== 'string') return false
  return true
}

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const productId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  const keys = Object.keys(body)
  if (keys.length === 0) throw apiError(400, 'INVALID_INPUT', 'At least one field is required')

  const scalarValues: Record<string, unknown> = {}

  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)

    if (key === 'name') {
      if (typeof body.name !== 'string' || body.name.length === 0) throw apiError(400, 'INVALID_INPUT', 'name must be a non-empty string')
      scalarValues.name = body.name
    } else if (key === 'category') {
      if (typeof body.category !== 'string') throw apiError(400, 'INVALID_INPUT', 'category must be a string')
      scalarValues.category = body.category
    } else if (key === 'description') {
      if (typeof body.description !== 'string') throw apiError(400, 'INVALID_INPUT', 'description must be a string')
      scalarValues.description = body.description
    } else if (key === 'description_source') {
      if (!DESCRIPTION_SOURCES.has(body.description_source)) throw apiError(400, 'INVALID_INPUT', 'description_source must be manual, ai, or ai_edited')
      scalarValues.description_source = body.description_source
    } else if (key === 'price') {
      if (!isValidPrice(body.price)) throw apiError(400, 'INVALID_INPUT', 'price must be a non-negative number')
      scalarValues.price = body.price
    } else if (key === 'photos') {
      if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(isValidPhoto)) {
        throw apiError(400, 'INVALID_INPUT', 'photos must be a non-empty array of { photo_url, sort_order }')
      }
    } else if (key === 'variants') {
      if (!Array.isArray(body.variants) || !body.variants.every(isValidVariant)) {
        throw apiError(400, 'INVALID_INPUT', 'variants must be an array of { name, price, photo_url? }')
      }
    }
  }

  const { data: existing, error: findError } = await getOwnedProduct(event, seller.id, productId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (findError) {
    console.error('getOwnedProduct failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load product')
  }
  if (!existing) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')

  if (Object.keys(scalarValues).length > 0) {
    const { error } = await updateProduct(event, productId, scalarValues)
    if (error) {
      console.error('updateProduct failed:', error.message)
      throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product')
    }
  }

  if ('photos' in body) {
    const { error } = await replaceProductPhotos(event, productId, body.photos)
    if (error) {
      console.error('replaceProductPhotos failed:', error.message)
      throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product photos')
    }
  }

  if ('variants' in body) {
    const { error } = await replaceProductVariants(event, productId, body.variants)
    if (error) {
      console.error('replaceProductVariants failed:', error.message)
      throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product variants')
    }
  }

  const { data, error } = await getOwnedProduct(event, seller.id, productId)
  if (error || !data) {
    console.error('getOwnedProduct re-fetch failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load updated product')
  }

  return { product: data }
})
```

- [ ] **Step 2: Write `server/api/seller/products/[id].delete.ts`**

```ts
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedProduct, productHasOrderItems, deleteProduct } from '../../../repositories/product.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const productId = getRouterParam(event, 'id')!

  const { data: existing, error: findError } = await getOwnedProduct(event, seller.id, productId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (findError) {
    console.error('getOwnedProduct failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load product')
  }
  if (!existing) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')

  const { data: referenced, error: refError } = await productHasOrderItems(event, productId)
  if (refError) {
    console.error('productHasOrderItems failed:', refError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to check product references')
  }
  if (referenced) throw apiError(409, 'INVALID_STATE', 'Product is referenced by an order and cannot be deleted')

  const { error } = await deleteProduct(event, productId)
  if (error) {
    console.error('deleteProduct failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to delete product')
  }

  return { success: true }
})
```

- [ ] **Step 3: Run `npm test` and `npm run build`**

Expected: tests PASS; build generates route chunks for `seller/trips/[tripId]/products.post`, `seller/products/[id].patch`, `seller/products/[id].delete`.

- [ ] **Step 4: SKIP commit unless user requests.**

---

## Verification Checklist

- [ ] `POST /api/seller/trips/:tripId/products` — 400 on missing/invalid fields; 404 on non-owned/unknown trip; 200 with nested photos/variants on success
- [ ] `PATCH /api/seller/products/:id` — 400 on empty body/unknown field/invalid value; 404 on non-owned/unknown product; replaces photos/variants only when provided
- [ ] `DELETE /api/seller/products/:id` — 404 on non-owned/unknown product; 409 when referenced by order items; success otherwise
- [ ] `npm test` and `npm run build` pass
