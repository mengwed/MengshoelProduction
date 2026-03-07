import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/lib/validations', () => ({
  customerSchema: {},
  validateBody: vi.fn(),
}))

import { PUT, DELETE } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/validations'

const customerData = {
  id: 'cust-1',
  name: 'Updated Customer',
}

function mockSupabasePut(overrides?: { data?: any; error?: any }) {
  const mock = {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: overrides?.data ?? customerData,
              error: overrides?.error ?? null,
            }),
          }),
        }),
      }),
    }),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

function mockSupabaseDelete(overrides?: { error?: any }) {
  const mock = {
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: overrides?.error ?? null,
        }),
      }),
    }),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/customers/cust-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PUT /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
    vi.mocked(validateBody).mockReturnValue({ data: { name: 'Updated Customer' } })
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await PUT(
      makeRequest({ name: 'Updated Customer' }),
      makeParams('cust-1')
    )
    expect(res.status).toBe(401)
  })

  it('returns validation error', async () => {
    vi.mocked(validateBody).mockReturnValue({
      error: Response.json({ error: 'Validation failed' }, { status: 400 }),
    })

    const res = await PUT(
      makeRequest({ name: '' }),
      makeParams('cust-1')
    )
    expect(res.status).toBe(400)
  })

  it('updates customer and returns 200', async () => {
    mockSupabasePut()

    const res = await PUT(
      makeRequest({ name: 'Updated Customer' }),
      makeParams('cust-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Updated Customer')
  })

  it('returns 500 on database error', async () => {
    mockSupabasePut({ data: null, error: { message: 'DB error' } })

    const res = await PUT(
      makeRequest({ name: 'Updated Customer' }),
      makeParams('cust-1')
    )
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await DELETE(
      new Request('http://localhost/api/customers/cust-1', { method: 'DELETE' }),
      makeParams('cust-1')
    )
    expect(res.status).toBe(401)
  })

  it('deletes customer', async () => {
    mockSupabaseDelete()

    const res = await DELETE(
      new Request('http://localhost/api/customers/cust-1', { method: 'DELETE' }),
      makeParams('cust-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)
  })

  it('returns 500 on database error', async () => {
    mockSupabaseDelete({ error: { message: 'DB error' } })

    const res = await DELETE(
      new Request('http://localhost/api/customers/cust-1', { method: 'DELETE' }),
      makeParams('cust-1')
    )
    expect(res.status).toBe(500)
  })
})
