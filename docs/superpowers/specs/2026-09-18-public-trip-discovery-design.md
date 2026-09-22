# Public Trip Discovery API Design

## Goal

Public endpoints for viewing a trip by slug and subscribing to open notifications.

## Scope

- `GET /api/trips/by-slug/:slug`
- `POST /api/trips/:id/subscribe`

No authentication. Product/photo/variant read-only. Email delivery on trip open deferred.

## Data behavior

### GET by-slug

Nested Supabase select: `trips.*, products(*, product_photos(*), product_variants(*))` filtered by `slug`.

- `coming_soon`: response omits product data (`products: []`).
- `open` / `closed`: response includes products with photos and variants as fetched.
- Not found → `404 TRIP_NOT_FOUND`.

### POST subscribe

Body: `{ email: string }`. Validation: non-empty string, basic email format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).

- Trip lookup by `id`. Not found → `404 TRIP_NOT_FOUND`.
- Allowed only while `status === 'coming_soon'`; otherwise `409 INVALID_STATE`.
- Upsert on unique `(trip_id, email)` — repeat subscribe for the same email is a no-op success (idempotent), not an error.
- No email is sent from this endpoint.

## Architecture

`server/repositories/trip-public.repository.ts`:
- `getTripBySlug(event, slug)`
- `insertSubscriber(event, tripId, email)` (upsert, `onConflict: 'trip_id,email'`)

Handlers:
- `server/api/trips/by-slug/[slug].get.ts`
- `server/api/trips/[id]/subscribe.post.ts`

Both thin: validate → repository call → map errors → return JSON. No `requireSeller`/`requireUser` — fully public.

## Error contract

Same shape as existing endpoints (`apiError`).

- invalid email: `400 INVALID_INPUT`
- missing trip: `404 TRIP_NOT_FOUND`
- subscribe on non-`coming_soon` trip: `409 INVALID_STATE`
- repository failure: `500 INTERNAL_ERROR`

## Testing

Self-check tests (inline-copy pattern) for:
- email format validation
- subscribe status gate (`coming_soon` only)

Run `npm test` and `npm run build`.

## Deferred

- Open-notification email send
- Product filtering (`q`, `min_price`, `max_price` query params)
- Rate limiting on subscribe
