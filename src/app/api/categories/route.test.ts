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
  categorySchema: {},
  validateBody: vi.fn(),
}))

import { GET, POST } from './route'
import { PUT, DELETE } from './[id]/route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/validations'

const categoryData = [
  { id: 'cat-1', name: 'Programvara', emoji: '💻' },
  { id: 'cat-2', name: 'Kontorsmaterial', emoji: '📎' },
]

function makeChainableMock(resolvedData: unknown = categoryData, resolvedError: any = null) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'order', 'eq', 'insert', 'update', 'delete', 'single']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: any) => resolve({ data: resolvedData, error: resolvedError })
  return chain
}

function mockSupabase(resolvedData: unknown = categoryData, resolvedError: any = null) {
  const chain = makeChainableMock(resolvedData, resolvedError)
  const mock = {
    from: vi.fn().mockReturnValue(chain),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return { mock, chain }
}

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns categories on success', async () => {
    mockSupabase()
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].name).toBe('Programvara')
    expect(body.data[1].name).toBe('Kontorsmaterial')
  })

  it('returns 500 on DB error', async () => {
    mockSupabase(null, { message: 'Database error' })
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Database error')
  })
})

describe('POST /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const request = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ny kategori' }),
    })
    const res = await POST(request)
    expect(res.status).toBe(401)
  })

  it('creates category and returns 201', async () => {
    const newCategory = { id: 'cat-3', name: 'Resor', emoji: '✈️' }
    mockSupabase(newCategory)
    vi.mocked(validateBody).mockReturnValue({ data: { name: 'Resor', emoji: '✈️' } })

    const request = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Resor', emoji: '✈️' }),
    })
    const res = await POST(request)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.name).toBe('Resor')
  })
})

describe('PUT /api/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('updates category', async () => {
    const updated = { id: 'cat-1', name: 'Uppdaterad', emoji: '🔧' }
    mockSupabase(updated)
    vi.mocked(validateBody).mockReturnValue({ data: { name: 'Uppdaterad', emoji: '🔧' } })

    const request = new Request('http://localhost/api/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Uppdaterad', emoji: '🔧' }),
    })
    const res = await PUT(request, { params: Promise.resolve({ id: 'cat-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Uppdaterad')
  })
})

describe('DELETE /api/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('clears references and deletes category', async () => {
    const { mock } = mockSupabase({ success: true })
    const request = new Request('http://localhost/api/categories/cat-1', {
      method: 'DELETE',
    })
    const res = await DELETE(request, { params: Promise.resolve({ id: 'cat-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)

    // Verify it clears references on suppliers and documents before deleting
    expect(mock.from).toHaveBeenCalledWith('suppliers')
    expect(mock.from).toHaveBeenCalledWith('documents')
    expect(mock.from).toHaveBeenCalledWith('categories')
  })
})
