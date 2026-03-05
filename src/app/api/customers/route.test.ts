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
