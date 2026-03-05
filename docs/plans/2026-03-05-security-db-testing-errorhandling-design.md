# Design: Security, Database, Testing & Error Handling

**Date:** 2026-03-05
**Status:** Approved

## 1. Auth Checks on API Routes

Create `src/lib/auth.ts` with a `requireAuth()` helper that verifies the Supabase session. Returns authenticated user or 401. All ~12 API route files call this at the start. No workspace/org filtering - just verify the user is logged in (2 users share all data).

## 2. Input Validation with Zod

Install `zod`. Create `src/lib/validations.ts` with schemas:
- `customerSchema`, `supplierSchema`, `categorySchema`, `documentUpdateSchema`
- `validateRequest(schema, body)` helper returns parsed data or 400 response

## 3. Rate Limiting & Request Size Limits

In-memory sliding window rate limiter in `src/lib/rate-limit.ts`:
- Upload route: 10 requests/min per IP
- Other routes: 30 requests/min per IP
- Request body size limit set in `next.config.ts` via config

## 4. XSS Sanitization

`src/lib/sanitize.ts` with `sanitize()` function that strips HTML tags from strings. Applied in upload route after AI extraction, before saving to database.

## 5. Database Improvements

- Create `supabase/migrations/` with timestamped SQL files
- Add UNIQUE constraints on `suppliers.name`, `customers.name`, `categories.name`
- Create `audit_log` table: `id, table_name, record_id, action, old_data, new_data, user_id, created_at`
- Move `BankTransaction` type from `bankavstamning/page.tsx` to `src/types/index.ts`

## 6. Error Handling

- **Consistent API format:** `src/lib/api-response.ts` with `apiError(message, status)` and `apiSuccess(data, status?)`. All routes use `{ error: string }` or `{ data: ... }`.
- **Silent PDF error:** Fix DocumentPanel to show error message instead of infinite "Laddar PDF..."
- **AI extraction:** Return 503 if AI fails instead of creating empty document
- **Error boundary:** `src/components/ErrorBoundary.tsx` catches render errors with fallback UI

## 7. Testing

Basic tests for critical flows:
- API routes: auth (401), validation (400), happy path CRUD
- Bank matching: edge cases (duplicate amounts, no match, date boundaries)
- AI extraction: mock Claude API, test sanitization, test error handling
- Rate limiter: test blocking after max requests
