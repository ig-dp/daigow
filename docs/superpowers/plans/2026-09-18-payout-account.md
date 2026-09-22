# Payout Account API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add authenticated seller endpoints to read and upsert a Jastiper payout account.

**Architecture:** Thin Nitro handlers authenticate the request, verify the user's profile role, validate input, then call a focused payout-account repository. Supabase service-role access remains server-only and every query is scoped by `jastiper_id`.

**Tech Stack:** Nuxt 4, Nitro/H3, TypeScript, Supabase, Node built-in test runner.

## Global Constraints

- Endpoints: `GET /api/seller/payout-account` and `PUT /api/seller/payout-account`.
- Require a Supabase-authenticated user.
- Allow only profile roles `jastiper` and `admin`; other authenticated roles receive `403 FORBIDDEN`.
- Use `PayoutAccount` fields `jastiper_id`, `bank_code`, `account_number`, `account_holder_name`, `updated_at`.
- All three input fields must be present, strings, and non-empty.
- Preserve `account_number` as a string, including leading zeroes.
- `PUT` upserts by unique `jastiper_id`.
- `GET` without an account returns `404 PAYOUT_ACCOUNT_NOT_FOUND`.
- Errors use `{ "error": { "code": "...", "message": "..." } }`.
- Do not add strict bank or account-number format validation yet.
- Do not add dependencies or unrelated refactors.

---

### Task 1: Implement payout-account repository, role gate, and endpoints

**Files:**
- Create: `server/repositories/payout-account.repository.ts`
- Create: `server/utils/require-seller.ts`
- Create: `server/api/seller/payout-account.get.ts`
- Create: `server/api/seller/payout-account.put.ts`

**Interfaces:**
- `requireSeller(event: H3Event): Promise<{ id: string; role: 'jastiper' | 'admin' }>` authenticates via `requireUser`, reads the user's profile, and throws `401 AUTH_REQUIRED`, `403 FORBIDDEN`, or `500 INTERNAL_ERROR` as appropriate.
- `getPayoutAccount(event: H3Event, userId: string)` returns the Supabase query for the user's account.
- `upsertPayoutAccount(event: H3Event, userId: string, values: { bank_code: string; account_number: string; account_holder_name: string })` upserts by `jastiper_id` and returns the saved row.

- [ ] **Step 1: Add role-gate behavior tests to `tests/profile-api.test.mjs`**

Add pure self-check functions mirroring the already-tested API error decisions:

```js
function sellerRoleAllowed(role) {
  return role === 'jastiper' || role === 'admin'
}

function validatePayoutAccount(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  return ['bank_code', 'account_number', 'account_holder_name'].every(
    (key) => typeof body[key] === 'string' && body[key].length > 0
  )
}
```

Assert `jastiper` and `admin` are allowed, `buyer` is rejected, a complete body passes, and a missing/empty field fails.

- [ ] **Step 2: Implement `requireSeller`**

Use `requireUser(event)` first. Fetch the profile with `getProfile(event, user.id)`. Map `PGRST116` to `404 PROFILE_NOT_FOUND`, other repository errors to `500 INTERNAL_ERROR`, and roles other than `jastiper`/`admin` to `403 FORBIDDEN`. Return the user ID and allowed role.

- [ ] **Step 3: Implement repository methods**

Use `getSupabaseAdmin(event).from('payout_accounts')` and select exactly:

```text
id,jastiper_id,bank_code,account_number,account_holder_name,updated_at
```

`getPayoutAccount` filters `.eq('jastiper_id', userId).single()`.

`upsertPayoutAccount` calls `.upsert({ jastiper_id: userId, ...values }, { onConflict: 'jastiper_id' }).select(fields).single()`.

- [ ] **Step 4: Implement GET handler**

Call `requireSeller(event)` then `getPayoutAccount(event, seller.id)`. Map `PGRST116` to `404 PAYOUT_ACCOUNT_NOT_FOUND`, other errors to `500 INTERNAL_ERROR`, and return `{ payoutAccount: data }`.

- [ ] **Step 5: Implement PUT handler**

Call `requireSeller(event)`, parse the body with `readBody`, reject null, arrays, primitives, missing fields, empty strings, and unknown fields with `400 INVALID_INPUT`. Call `upsertPayoutAccount` and return `{ payoutAccount: data }`. Map repository failures to `500 INTERNAL_ERROR`.

- [ ] **Step 6: Run checks**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Nuxt production build succeeds.

- [ ] **Step 7: Commit**

Do not create a commit unless explicitly requested by the user.

### Verification checklist

- Unauthenticated request → `401 AUTH_REQUIRED`.
- Buyer request → `403 FORBIDDEN`.
- Jastiper/admin GET with no row → `404 PAYOUT_ACCOUNT_NOT_FOUND`.
- PUT incomplete or unknown body → `400 INVALID_INPUT`.
- PUT valid body → upsert scoped to authenticated user ID.
- Account number remains a string.
- No service-role key reaches client code.
