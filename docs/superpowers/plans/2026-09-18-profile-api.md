# Profile API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /api/me`, `PATCH /api/me`, and `POST /api/me/become-jastiper` with thin Nitro handlers and isolated Supabase access.

**Architecture:** Route handlers parse HTTP input and delegate to use cases. Repository code owns Supabase queries. Auth and invite-code comparison remain server-only; role changes use the service-role client.

**Tech Stack:** Nuxt 4, Nitro, `@nuxtjs/supabase`, Supabase Postgres, TypeScript, Node `crypto.timingSafeEqual`.

## Global Constraints

- Errors use `{ error: { code: string, message: string } }`.
- Invalid state returns HTTP 409 with code `INVALID_STATE`.
- Client cannot update `profiles.role`.
- Invite comparison is constant-time.
- Invite attempts are limited to 5 per user per hour.
- No new dependency for validation or rate limiting.

---

### Task 1: Server Supabase and shared HTTP helpers

**Files:**
- Create: `server/utils/supabase-admin.ts`
- Create: `server/utils/api-error.ts`
- Create: `server/utils/auth.ts`
- Create: `server/repositories/profile.repository.ts`

**Interfaces:**
- `getSupabaseAdmin(event)` returns a service-role Supabase client.
- `requireUser(event)` returns `{ id: string }` or throws a structured 401 error.
- `apiError(status, code, message)` creates an H3 error with the documented response shape.
- Repository functions: `getProfile(userId)`, `updateProfile(userId, values)`, `setRole(userId, role)`.

- [ ] **Step 1: Add the admin client helper**

Use `useRuntimeConfig(event)` and `serverSupabaseServiceRoleKey`; never expose the key to client code.

- [ ] **Step 2: Add structured API errors**

Create an H3 error whose `data` is `{ error: { code, message } }`.

- [ ] **Step 3: Add session authentication**

Use `serverSupabaseUser(event)` from `@nuxtjs/supabase`, reject missing users with `401 AUTH_REQUIRED`.

- [ ] **Step 4: Add profile repository queries**

Select profile fields `id,name,email,phone,role,created_at`; update only `name` and `phone`; role update is a separate function using admin client.

- [ ] **Step 5: Run typecheck/build**

Run `npm run build`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat: add profile server foundations"
```

### Task 2: GET/PATCH `/api/me`

**Files:**
- Create: `server/api/me.get.ts`
- Create: `server/api/me.patch.ts`

**Interfaces:**
- `GET /api/me` returns the authenticated profile.
- `PATCH /api/me` accepts `{ name?: string, phone?: string | null }`, rejects unknown/invalid values, and never accepts `role`.

- [ ] **Step 1: Implement GET handler**

Require a session, load the profile repository record, return `{ profile }`; missing profile returns `404 PROFILE_NOT_FOUND`.

- [ ] **Step 2: Implement PATCH handler**

Parse JSON body, allow only `name` and `phone`, require non-empty string `name` when present, allow nullable string `phone`, reject any other key with `400 INVALID_INPUT`, then update and return `{ profile }`.

- [ ] **Step 3: Run build**

Run `npm run build`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/api/me.get.ts server/api/me.patch.ts
git commit -m "feat: add profile API"
```

### Task 3: Become Jastiper use case and endpoint

**Files:**
- Create: `server/usecases/profile/become-jastiper.ts`
- Create: `server/api/me/become-jastiper.post.ts`
- Create: `server/utils/invite-rate-limit.ts`

**Interfaces:**
- `becomeJastiper(userId, code)` returns the updated profile.
- `POST /api/me/become-jastiper` accepts `{ code }`.

- [ ] **Step 1: Add in-memory attempt limiter**

Track timestamps by user ID in a module-local `Map`; retain only timestamps from the last hour; reject the sixth attempt with `429 RATE_LIMITED`. Add comment: `ponytail: in-memory limiter resets on deploy; use shared storage when multiple instances matter`.

- [ ] **Step 2: Add constant-time invite comparison**

Use `timingSafeEqual` on UTF-8 buffers after equal-length padding/normalization logic; missing or wrong invite code returns `403 INVALID_INVITE_CODE` without changing the role.

- [ ] **Step 3: Add use case**

Load profile. If role is `jastiper` or `admin`, throw `409 INVALID_STATE`. Consume one attempt, compare against `config.jastiperInviteCode`, then call `setRole(userId, 'jastiper')`.

- [ ] **Step 4: Add endpoint**

Require session, validate `{ code }` as a non-empty string, call use case, return `{ profile }`.

- [ ] **Step 5: Run build**

Run `npm run build`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/api/me server/usecases/profile server/utils/invite-rate-limit.ts
git commit -m "feat: add become-jastiper API"
```

### Task 4: Minimal pure self-check

**Files:**
- Create: `server/utils/invite-rate-limit.test.ts` or `tests/profile-api.test.ts`
- Modify: `package.json` only if a native test command is needed

- [ ] **Step 1: Add assertions for invite comparison and attempt ceiling**

Cover equal invite, wrong invite, and sixth attempt rejection. Keep it dependency-free where possible.

- [ ] **Step 2: Run the check**

Run the project’s available test command, or `node --test` if the file is executable JavaScript. Expected: PASS.

- [ ] **Step 3: Run final build**

Run `npm run build`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server package.json package-lock.json
git commit -m "test: cover profile invite rules"
```
