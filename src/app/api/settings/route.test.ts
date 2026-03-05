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

import { GET, PUT } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const settingsData = {
  id: 1,
  company_name: 'Mengshoel Production',
  organization_type: 'enskild firma',
  owner_name: 'Anne Juul Mengshoel',
  industry: null,
  notes: null,
}

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { ...settingsData, company_name: 'Updated' }, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
        }),
      }),
    }),
    ...overrides,
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns settings on success', async () => {
    mockSupabase()
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.company_name).toBe('Mengshoel Production')
  })

  it('returns 500 on database error', async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: 'Test', organization_type: 'aktiebolag' }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it('updates existing settings', async () => {
    mockSupabase()
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Updated',
        organization_type: 'aktiebolag',
        owner_name: 'New Owner',
      }),
    })

    const res = await PUT(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.company_name).toBe('Updated')
  })

  it('inserts settings when none exist', async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
          }),
        }),
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Mengshoel Production',
        organization_type: 'enskild firma',
      }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(201)
  })
})
