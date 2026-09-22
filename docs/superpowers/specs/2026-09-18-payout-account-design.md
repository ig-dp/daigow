# Payout Account API Design

**Goal:** Add authenticated seller endpoints for reading and upserting a Jastiper payout account.

## Scope

- `GET /api/seller/payout-account`
- `PUT /api/seller/payout-account`

## Authorization

- Require a Supabase-authenticated user.
- Allow only `jastiper` and `admin` profile roles.
- Other authenticated roles receive `403 FORBIDDEN`.

## Data

Use the existing `PayoutAccount` table:

- `jastiper_id` — unique user ID
- `bank_code` — non-empty string
- `account_number` — non-empty string; preserve leading zeroes
- `account_holder_name` — non-empty string
- `updated_at`

The repository uses the existing service-role Supabase access pattern and scopes every query to the authenticated user's ID. `PUT` upserts by unique `jastiper_id`.

## Request and response

`PUT /api/seller/payout-account` accepts:

```json
{
  "bank_code": "BRI",
  "account_number": "1234567890",
  "account_holder_name": "Nama Pemilik"
}
```

All fields must be present, strings, and non-empty. No strict bank whitelist or account-number format is enforced yet.

Successful responses return the payout account object. `GET` with no configured account returns `404 PAYOUT_ACCOUNT_NOT_FOUND`.

All errors use `{ "error": { "code": "...", "message": "..." } }`.

## Architecture

Handlers remain thin. Add a payout-account repository for Supabase queries and a small role authorization helper or shared profile lookup. Avoid unrelated refactors.

## Testing

Add a focused Node built-in test self-check covering validation and role/error decisions without adding dependencies. Run `npm test` and `npm run build`.

## Deferred

- Xendit bank-code validation.
- Account-number format validation.
- Encryption/tokenization beyond existing database/security configuration.
