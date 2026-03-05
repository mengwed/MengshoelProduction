# Security, Database, Testing & Error Handling - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the AJ accounting app with auth checks, input validation, rate limiting, XSS sanitization, database migrations, consistent error handling, and basic test coverage.

**Architecture:** Add middleware-style helpers (auth, validation, rate limiting, API responses) that all API routes import. Create Supabase migration files for DB changes. Add Vitest tests for critical paths.

**Tech Stack:** Next.js 16, Supabase, Zod, Vitest, Testing Library

---

### Task 1: Install Zod

**Files:**
- Modify: `package.json`

**Step 1: Install zod**

Run: `npm install zod`

**Step 2: Verify installation**

Run: `npm ls zod`
Expected: `zod@3.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod for input validation"
```

---

### Task 2: Create auth helper

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/auth.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from './auth'

describe('requireAuth', () => {
  it('returns user when session exists', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' }
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as any)

    const user = await requireAuth()
    expect(user.id).toBe('user-123')
  })

  it('throws AuthError when no session', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'No session' } }),
      },
    } as any)

    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/lib/auth.ts
import { createClient } from '@/lib/supabase/server'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError()
  }

  return user
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add requireAuth helper with tests"
```

---

### Task 3: Create API response helpers

**Files:**
- Create: `src/lib/api-response.ts`
- Test: `src/lib/api-response.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/api-response.test.ts
import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, handleApiError } from './api-response'
import { AuthError } from './auth'

describe('apiSuccess', () => {
  it('returns JSON response with data', async () => {
    const res = apiSuccess({ name: 'test' })
    const body = await res.json()
    expect(body).toEqual({ data: { name: 'test' } })
    expect(res.status).toBe(200)
  })

  it('supports custom status code', async () => {
    const res = apiSuccess({ id: 1 }, 201)
    expect(res.status).toBe(201)
  })
})

describe('apiError', () => {
  it('returns JSON error response', async () => {
    const res = apiError('Not found', 404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not found' })
    expect(res.status).toBe(404)
  })
})

describe('handleApiError', () => {
  it('returns 401 for AuthError', async () => {
    const res = handleApiError(new AuthError())
    expect(res.status).toBe(401)
  })

  it('returns 500 for unknown errors', async () => {
    const res = handleApiError(new Error('Something broke'))
    const body = await res.json()
    expect(body).toEqual({ error: 'Internal server error' })
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api-response.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/api-response.ts
import { NextResponse } from 'next/server'
import { AuthError } from './auth'

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return apiError('Unauthorized', 401)
  }

  console.error('API error:', error)
  return apiError('Internal server error', 500)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api-response.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/api-response.ts src/lib/api-response.test.ts
git commit -m "feat: add consistent API response helpers with tests"
```

---

### Task 4: Create Zod validation schemas

**Files:**
- Create: `src/lib/validations.ts`
- Test: `src/lib/validations.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/validations.test.ts
import { describe, it, expect } from 'vitest'
import { customerSchema, supplierSchema, categorySchema, documentUpdateSchema } from './validations'

describe('customerSchema', () => {
  it('accepts valid customer', () => {
    const result = customerSchema.safeParse({ name: 'Test AB' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = customerSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = customerSchema.safeParse({
      name: 'Test AB',
      org_number: '556677-8899',
      email: 'test@test.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = customerSchema.safeParse({ name: 'Test', email: 'not-email' })
    expect(result.success).toBe(false)
  })
})

describe('supplierSchema', () => {
  it('accepts valid supplier with category_id', () => {
    const result = supplierSchema.safeParse({ name: 'Supplier AB', category_id: 5 })
    expect(result.success).toBe(true)
  })

  it('accepts null category_id', () => {
    const result = supplierSchema.safeParse({ name: 'Supplier AB', category_id: null })
    expect(result.success).toBe(true)
  })
})

describe('categorySchema', () => {
  it('accepts valid category', () => {
    const result = categorySchema.safeParse({ name: 'Transport', emoji: '🚗' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = categorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('documentUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = documentUpdateSchema.safeParse({ status: 'reviewed' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = documentUpdateSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('accepts amount as number', () => {
    const result = documentUpdateSchema.safeParse({ amount: 1500.50 })
    expect(result.success).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/validations.ts
import { z } from 'zod'
import { apiError } from './api-response'

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  org_number: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  org_number: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  category_id: z.number().int().positive().nullable().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
})

export const documentUpdateSchema = z.object({
  type: z.enum([
    'outgoing_invoice', 'incoming_invoice', 'payment_received',
    'credit_card_statement', 'government_fee', 'loan_statement',
    'receipt', 'other',
  ]).optional(),
  invoice_number: z.string().max(100).nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  vat: z.number().nullable().optional(),
  vat_rate: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  status: z.enum(['imported', 'reviewed', 'paid']).optional(),
  customer_id: z.number().int().positive().nullable().optional(),
  supplier_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  payment_date: z.string().nullable().optional(),
  ai_needs_review: z.boolean().optional(),
})

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: ReturnType<typeof apiError> } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return { error: apiError(message, 400) }
  }
  return { data: result.data }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/validations.test.ts
git commit -m "feat: add Zod validation schemas with tests"
```

---

### Task 5: Create rate limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3 })
    expect(limiter.check('ip1').allowed).toBe(true)
    expect(limiter.check('ip1').allowed).toBe(true)
    expect(limiter.check('ip1').allowed).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2 })
    limiter.check('ip1')
    limiter.check('ip1')
    const result = limiter.check('ip1')
    expect(result.allowed).toBe(false)
  })

  it('tracks IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 })
    limiter.check('ip1')
    expect(limiter.check('ip2').allowed).toBe(true)
  })

  it('resets after window expires', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 })
    limiter.check('ip1')
    expect(limiter.check('ip1').allowed).toBe(false)

    vi.advanceTimersByTime(61000)
    expect(limiter.check('ip1').allowed).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/rate-limit.ts
interface RateLimitConfig {
  windowMs: number
  max: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
}

interface TokenBucket {
  tokens: number[]
}

export function createRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, TokenBucket>()

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const bucket = buckets.get(key) || { tokens: [] }

      // Remove expired tokens
      bucket.tokens = bucket.tokens.filter(t => now - t < config.windowMs)

      if (bucket.tokens.length >= config.max) {
        buckets.set(key, bucket)
        return { allowed: false, remaining: 0 }
      }

      bucket.tokens.push(now)
      buckets.set(key, bucket)
      return { allowed: true, remaining: config.max - bucket.tokens.length }
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat: add in-memory rate limiter with tests"
```

---

### Task 6: Create XSS sanitizer

**Files:**
- Create: `src/lib/sanitize.ts`
- Test: `src/lib/sanitize.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/sanitize.test.ts
import { describe, it, expect } from 'vitest'
import { sanitize, sanitizeObject } from './sanitize'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('preserves normal text', () => {
    expect(sanitize('Faktura 12345')).toBe('Faktura 12345')
  })

  it('strips nested tags', () => {
    expect(sanitize('<div><b>bold</b></div>')).toBe('bold')
  })

  it('handles null/undefined', () => {
    expect(sanitize(null)).toBe(null)
    expect(sanitize(undefined)).toBe(undefined)
  })
})

describe('sanitizeObject', () => {
  it('sanitizes all string values in object', () => {
    const result = sanitizeObject({
      name: '<b>Test</b>',
      amount: 100,
      note: '<script>x</script>',
    })
    expect(result).toEqual({
      name: 'Test',
      amount: 100,
      note: 'x',
    })
  })

  it('handles nested objects', () => {
    const result = sanitizeObject({
      counterpart_name: '<img onerror=alert(1)>Safe Name',
    })
    expect(result.counterpart_name).toBe('Safe Name')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sanitize.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/sanitize.ts
export function sanitize(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  return value.replace(/<[^>]*>/g, '')
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  for (const key in result) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = sanitize(result[key] as string)
    }
  }
  return result
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sanitize.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/sanitize.ts src/lib/sanitize.test.ts
git commit -m "feat: add XSS sanitizer with tests"
```

---

### Task 7: Apply auth + validation + rate limiting + error handling to all API routes

This is the largest task. Update all API route files to use the new helpers.

**Files:**
- Create: `src/lib/rate-limit-instances.ts`
- Modify: `src/app/api/customers/route.ts`
- Modify: `src/app/api/customers/[id]/route.ts`
- Modify: `src/app/api/suppliers/route.ts`
- Modify: `src/app/api/suppliers/[id]/route.ts`
- Modify: `src/app/api/categories/route.ts`
- Modify: `src/app/api/categories/[id]/route.ts`
- Modify: `src/app/api/documents/route.ts`
- Modify: `src/app/api/documents/[id]/route.ts`
- Modify: `src/app/api/documents/upload/route.ts`
- Modify: `src/app/api/documents/[id]/pdf-url/route.ts`
- Modify: `src/app/api/documents/export/route.ts`
- Modify: `src/app/api/bank/transactions/route.ts`
- Modify: `src/app/api/bank/import/route.ts`
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/api/fiscal-years/route.ts`

**Step 1: Create rate limiter instances**

```typescript
// src/lib/rate-limit-instances.ts
import { createRateLimiter } from './rate-limit'

export const defaultLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })
export const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })
```

**Step 2: Update customers/route.ts (pattern for all simple CRUD routes)**

Replace full content of `src/app/api/customers/route.ts`:

```typescript
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { customerSchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('customers').select('*').order('name')

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(customerSchema, body)
    if ('error' in validated) return validated.error

    const { data, error } = await supabase
      .from('customers')
      .insert(validated.data)
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
```

**Step 3: Apply same pattern to all other routes**

Apply `requireAuth()` + `try/catch handleApiError()` + `apiSuccess()`/`apiError()` to:
- `customers/[id]/route.ts` - add auth + validation with customerSchema on PUT
- `suppliers/route.ts` - same pattern, use supplierSchema
- `suppliers/[id]/route.ts` - same pattern, use supplierSchema on PUT
- `categories/route.ts` - same pattern, use categorySchema
- `categories/[id]/route.ts` - same pattern, use categorySchema on PUT
- `documents/route.ts` - add auth, keep existing query logic, wrap in try/catch
- `documents/[id]/route.ts` - add auth + validation with documentUpdateSchema on PUT
- `documents/[id]/pdf-url/route.ts` - add auth
- `documents/export/route.ts` - add auth
- `bank/transactions/route.ts` - add auth
- `bank/import/route.ts` - add auth + uploadLimiter
- `dashboard/route.ts` - add auth
- `fiscal-years/route.ts` - add auth

**Step 4: Apply rate limiting to upload route**

In `src/app/api/documents/upload/route.ts` and `src/app/api/bank/import/route.ts`, add at top of handler:

```typescript
import { uploadLimiter } from '@/lib/rate-limit-instances'

// Inside POST handler, before any processing:
const ip = request.headers.get('x-forwarded-for') || 'unknown'
const rateCheck = uploadLimiter.check(ip)
if (!rateCheck.allowed) {
  return apiError('Too many requests', 429)
}
```

**Step 5: Fix AI extraction error handling in upload route**

Change the catch block in `src/app/api/documents/upload/route.ts` from creating a default document to returning 503:

```typescript
} catch (err) {
  console.error('AI extraction error:', err)
  // Clean up uploaded file
  await supabase.storage.from('documents').remove([filePath])
  return apiError('AI extraction failed. Please try again later.', 503)
}
```

**Step 6: Add XSS sanitization to upload route**

After AI extraction succeeds, sanitize the result:

```typescript
import { sanitizeObject } from '@/lib/sanitize'

// After extractFromPDF returns:
aiResult = sanitizeObject(aiResult)
```

**Step 7: Add body size limit to next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
```

**Step 8: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add auth, validation, rate limiting, sanitization to all API routes"
```

---

### Task 8: Create database migration files

**Files:**
- Create: `supabase/migrations/001_unique_constraints.sql`
- Create: `supabase/migrations/002_audit_log.sql`

**Step 1: Create unique constraints migration**

```sql
-- supabase/migrations/001_unique_constraints.sql
-- Add UNIQUE constraints to prevent duplicate names

ALTER TABLE customers ADD CONSTRAINT customers_name_unique UNIQUE (name);
ALTER TABLE suppliers ADD CONSTRAINT suppliers_name_unique UNIQUE (name);
ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);
```

**Step 2: Create audit log migration**

```sql
-- supabase/migrations/002_audit_log.sql
-- Audit log for tracking all data changes

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit log" ON audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert audit log" ON audit_log
  FOR INSERT TO service_role WITH CHECK (true);
```

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add database migrations for unique constraints and audit log"
```

---

### Task 9: Move BankTransaction type and clean up types

**Files:**
- Modify: `src/types/index.ts` - already has BankTransaction, verify it matches usage
- Modify: `src/app/(app)/bankavstamning/page.tsx` - remove local BankTransaction type, import from types

**Step 1: Read bankavstamning page to find the local type**

Check if there's a duplicate BankTransaction type defined locally.

**Step 2: Remove local type and import from @/types**

If a local BankTransaction type exists in bankavstamning/page.tsx, remove it and add:
```typescript
import type { BankTransaction } from '@/types'
```

**Step 3: Run build to verify**

Run: `npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/types/index.ts src/app/\(app\)/bankavstamning/page.tsx
git commit -m "refactor: centralize BankTransaction type in types/index.ts"
```

---

### Task 10: Fix DocumentPanel silent PDF error

**Files:**
- Modify: `src/components/DocumentPanel.tsx`

**Step 1: Fix the silent catch**

Change line 55 from:
```typescript
fetch(`/api/documents/${doc.id}/pdf-url`).then(r => r.json()).then(d => setPdfUrl(d.url)).catch(() => {})
```

To:
```typescript
fetch(`/api/documents/${doc.id}/pdf-url`)
  .then(r => r.json())
  .then(d => {
    if (d.url) {
      setPdfUrl(d.url)
    } else {
      setPdfUrl('error')
    }
  })
  .catch(() => setPdfUrl('error'))
```

**Step 2: Update the PDF viewer JSX**

Change the PDF viewer section to handle error state:

```tsx
{pdfUrl === 'error' ? (
  <div className="flex items-center justify-center h-full text-red-400">
    Kunde inte ladda PDF
  </div>
) : pdfUrl ? (
  <iframe src={pdfUrl} className="w-full h-full" title="Document PDF" />
) : (
  <div className="flex items-center justify-center h-full text-gray-600">
    Laddar PDF...
  </div>
)}
```

Note: also adds `title` attribute to iframe for accessibility.

**Step 3: Commit**

```bash
git add src/components/DocumentPanel.tsx
git commit -m "fix: show error message when PDF fails to load, add iframe title"
```

---

### Task 11: Create ErrorBoundary component

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

**Step 1: Write the component**

```tsx
// src/components/ErrorBoundary.tsx
'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-[200px] text-gray-400">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Något gick fel</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Försök igen
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Step 2: Add ErrorBoundary to app layout**

In `src/app/(app)/layout.tsx`, wrap the children with ErrorBoundary:

```tsx
import ErrorBoundary from '@/components/ErrorBoundary'

// In the return JSX, wrap {children} with:
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

**Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: add ErrorBoundary component to catch render errors"
```

---

### Task 12: Add API route tests

**Files:**
- Create: `src/app/api/customers/route.test.ts`

**Step 1: Write tests for customers API (pattern for others)**

```typescript
// src/app/api/customers/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor() { super('Unauthorized'); this.name = 'AuthError' }
  },
}))

import { GET, POST } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Test' }], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 1, name: 'New' }, error: null }),
        }),
      }),
    }),
    ...overrides,
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns customers on success', async () => {
    mockSupabase()
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })
})

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 400 for invalid body', async () => {
    mockSupabase()
    const req = new Request('http://localhost/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates customer with valid data', async () => {
    mockSupabase()
    const req = new Request('http://localhost/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Customer AB' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/app/api/customers/route.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/customers/route.test.ts
git commit -m "test: add API route tests for customers endpoint"
```

---

### Task 13: Add more matching edge case tests

**Files:**
- Modify: `src/lib/matching.test.ts`

**Step 1: Add edge case tests**

Append to `src/lib/matching.test.ts`:

```typescript
  describe('edge cases', () => {
    it('handles empty strings', () => {
      expect(similarity('', '')).toBe(0) // both filter to empty significant words
    })

    it('handles single-character names', () => {
      // Single chars filtered by w.length > 1
      expect(similarity('A', 'A')).toBe(0) // filtered out
    })

    it('handles names with only filler words', () => {
      expect(similarity('AB', 'Inc')).toBe(0)
    })

    it('handles Swedish company names with different suffixes', () => {
      const score = similarity('Volvo Group AB (publ)', 'Volvo Group')
      expect(score).toBeGreaterThanOrEqual(0.7)
    })

    it('handles partial overlap', () => {
      const score = similarity('Stockholm Energi AB', 'Energi Stockholm')
      expect(score).toBeGreaterThanOrEqual(0.7)
    })
  })
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/matching.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/matching.test.ts
git commit -m "test: add matching edge case tests"
```

---

### Task 14: Final verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run build**

Run: `npx next build`
Expected: Build succeeds

**Step 3: Run lint**

Run: `npx eslint src/`
Expected: No critical errors

**Step 4: Update TODO.md - mark completed items**

Mark all completed items in TODO.md with `[x]`.

**Step 5: Final commit**

```bash
git add TODO.md
git commit -m "docs: update TODO.md with completed items"
```
