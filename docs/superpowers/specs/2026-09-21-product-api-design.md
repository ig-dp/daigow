# Product API Design

**Goal:** Add seller product create, update, and delete APIs for trip catalogs.

**Architecture:** Thin Nitro handlers enforce input and seller ownership; `product.repository.ts` performs Supabase service-role queries. Product photos and variants are written with the product, while delete is blocked when order items reference the product.

## Endpoints

### `POST /api/seller/trips/:tripId/products`

Requires `jastiper` or `admin`, with ownership of the trip. Body accepts `name`, optional `category` and `description`, `description_source` (`manual`, `ai`, `ai_edited`), non-negative integer `price`, required `photos` array, optional `variants` array. Inserts product and child photos/variants. Unknown fields and malformed child objects return `400 INVALID_INPUT`.

### `PATCH /api/seller/products/:id`

Requires owner access. Product fields are patchable. If `photos` is present, replace all photos. If `variants` is present, replace all variants. Empty patch is invalid. Unknown fields return `400 INVALID_INPUT`.

### `DELETE /api/seller/products/:id`

Requires owner access. If any order item references the product, return `409 INVALID_STATE`; otherwise delete the product and cascading children.

## Error and data rules

- Missing product or non-owned resource: `404 PRODUCT_NOT_FOUND`.
- Seller role gate: existing `requireSeller`.
- All responses use `{ error: { code, message } }`.
- Prices are IDR whole numbers, `>= 0`.
- No storage upload or AI generation in this batch; routes receive URLs only.

## Verification

- Add pure validation tests for create/update payloads.
- Run `npm test` and `npm run build`.
- Manual Postman flow: create trip → create product → patch product → delete unreferenced product.
