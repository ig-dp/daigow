# Orders Buyer API Design

**Goal:** Add order creation and read-only tracking for buyers (guest or logged-in).

**Scope:** `POST /api/orders`, `GET /api/orders/track/:token`, `GET /api/me/orders`. Checkout, shipping, delivery-confirmation, and issue-report endpoints are a separate batch (depend on Xendit integration and multi-step status transitions).

**Architecture:** Thin Nitro handlers validate input and trip/product state; `order.repository.ts` performs Supabase service-role queries. Fee rates are hardcoded constants (no Settings table exists). Email notifications are stubbed via `console.log` (no email provider chosen yet) — a placeholder `sendEmail(to, subject, body)` util that logs, called from the right places, swappable later.

## Endpoints

### `POST /api/orders`
Public, session optional. Body: `trip_id`, `items[]` (`{ product_id, variant_id?, quantity }`), `buyer_name`, `buyer_email`, `buyer_phone`, `shipping_address` — all required regardless of login state.

Validation and flow:
1. Reject non-object body, unknown top-level keys, empty `items`.
2. `buyer_name`/`buyer_email`/`buyer_phone`/`shipping_address`: non-empty strings; `buyer_email` matches existing `isValidEmail` pattern.
3. Each item: `product_id` string, `variant_id` optional string, `quantity` positive integer.
4. Load trip by `trip_id`. Must exist and `status === 'open'` and `now` within `[order_open_at, order_close_at]`, else `409 INVALID_STATE`.
5. Load all referenced products (with variants) scoped to `trip_id` in one query. Any missing product → `404 PRODUCT_NOT_FOUND`. Product with variants but no `variant_id` given, or `variant_id` not belonging to that product → `400 INVALID_INPUT`.
6. Compute per item: `unit_price` (variant price if selected else product price), `line_total = unit_price * quantity`, snapshot fields (`product_name_snapshot`, `category_snapshot`, `variant_name_snapshot`, `snapshot_photo_url` = product's first photo by `sort_order`, or variant's `photo_url` if set).
7. `subtotal_amount = sum(line_total)`. `platform_fee_amount = round(subtotal_amount * PLATFORM_FEE_RATE)`. `total_amount = subtotal_amount + platform_fee_amount` (`channel_fee_amount = 0` at creation). `platform_fee_rate_snapshot` / `commission_rate_snapshot` copied from constants.
8. Generate `tracking_token` (32 random bytes, base64url via `randomBytes(32).toString('base64url')`). Generate `order_number` as `DG-<YYMMDD>-<4-digit random>` (collision acceptable at MVP scale — unique constraint catches it, retry once on conflict).
9. Insert `Order` (`status = 'awaiting_confirmation'`, `confirmation_deadline = now + 24h`, `buyer_id` = session user id if logged in else null) and `OrderItem` rows in the repository call.
10. Call stub `sendEmail` for buyer (tracking link) and Jastiper (new order). Fire-and-forget, do not fail the request if it throws.
11. Return `{ order_id, tracking_token }`.

### `GET /api/orders/track/:token`
Public. Looks up order by `tracking_token`. Not found → `404 ORDER_NOT_FOUND`. Returns full order detail with its items (no auth check — token itself is the credential, ≥32 random bytes is the security boundary per PRD).

### `GET /api/me/orders`
Requires session (`requireUser`). Returns all orders where `buyer_id = session.user.id`, newest first. Empty array if none — not an error.

## Error and data rules
- All responses use `{ error: { code, message } }`.
- `409 INVALID_STATE`: trip not open / outside order window.
- `404 TRIP_NOT_FOUND`, `404 PRODUCT_NOT_FOUND`, `404 ORDER_NOT_FOUND`.
- `400 INVALID_INPUT` for shape/type/missing-variant errors.
- Amounts are IDR whole numbers, rounded half-up (`Math.round`).
- Fee constants: `PLATFORM_FEE_RATE = 0.015`, `COMMISSION_RATE = 0.025` (from `server/utils/fees.ts`).

## Verification
- Pure validation/fee-calculation tests appended to `tests/profile-api.test.mjs` (existing pattern: inlined pure functions, not importing TS route code).
- Run `npm test` and `npm run build`.
- Manual Postman flow: create trip + open it, create product with variant, POST order, GET track/:token, GET /api/me/orders while logged in.
