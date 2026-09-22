# Trips Core API Design

## Goal

Implement the seller-facing trip lifecycle API: list, create, edit, open, and close trips.

## Scope

Five authenticated seller endpoints:

- `GET /api/seller/trips`
- `POST /api/seller/trips`
- `PATCH /api/seller/trips/:id`
- `POST /api/seller/trips/:id/open`
- `POST /api/seller/trips/:id/close`

Public trip discovery, subscribers, and open-notification email are deferred to the next batch.

## Authorization and ownership

All endpoints call `requireSeller(event)`, allowing `jastiper` and `admin` roles.

Trip queries are scoped by `jastiper_id`. A missing trip and a trip owned by another seller both return `404 TRIP_NOT_FOUND`; ownership is not exposed.

## Data behavior

### Create

Required non-empty string fields:

- `title`
- `destination`
- `thumbnail_url`
- `order_open_at`
- `order_close_at`

`description` is optional. Unknown fields and invalid values return `400 INVALID_INPUT`.

New trips always use:

- `status: coming_soon`
- generated unique slug: slugified title plus a six-character random suffix, for example `tokyo-maret-a1b2c3`
- null `opened_at` and `closed_at`

### List

Returns the authenticated seller's trips, ordered by `created_at` descending.

### Edit

PATCH accepts the create fields. It requires at least one allowed field, rejects unknown fields and invalid values, and preserves lifecycle fields. Closed trips cannot be edited and return `409 INVALID_STATE`.

### Open

Only `coming_soon` trips can open. The endpoint sets `status: open` and `opened_at` to the current timestamp. Other states return `409 INVALID_STATE`. No subscriber email is sent in this batch.

### Close

Only `open` trips can close. The endpoint sets `status: closed` and `closed_at` to the current timestamp. Other states return `409 INVALID_STATE`.

## Architecture

Handlers remain thin:

1. `requireSeller`
2. validate request input
3. call trip repository
4. map Supabase errors to the API error contract
5. return JSON

`server/repositories/trip.repository.ts` owns Supabase queries and selected fields. Lifecycle updates use owner-scoped queries with status predicates where practical.

## Error contract

Errors use the existing shape:

```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Trip cannot be opened"
  }
}
```

Mappings:

- unauthenticated: existing `requireUser` behavior
- missing profile: existing `PROFILE_NOT_FOUND`
- non-seller: existing `403 FORBIDDEN`
- invalid body: `400 INVALID_INPUT`
- missing or foreign trip: `404 TRIP_NOT_FOUND`
- invalid lifecycle transition: `409 INVALID_STATE`
- repository failure: `500 INTERNAL_ERROR`

## Testing

Extend the existing Node test suite with self-checks for:

- seller trip input validation
- PATCH requiring at least one allowed field
- slug format containing a normalized title and six-character suffix
- allowed lifecycle transitions only

Run `npm test` and `npm run build`.

## Deferred

- Public `GET /api/trips/by-slug/:slug`
- Public `POST /api/trips/:id/subscribe`
- subscriber notification email
- product/photo/variant payloads
- date-range business validation beyond non-empty strings
- collision retry for the generated slug
