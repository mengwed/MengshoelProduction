import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
  supplierSchema: {},
  validateBody: vi.fn(),
}))

import { GET, POST } from './route'
import { PUT, DELETE } from './[id]/route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/validations'

const supplierData = [
  {
    id: 'sup-1',
    name: 'Fortnox AB',
    org_number: '556799-1284',
    is_active: true,
    category_id: 'cat-1',
    categories: { name: 'Programvara', emoji: '💻' },
  },
]

function makeChainableMock(resolvedData: unknown = supplierData) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'order', 'eq', 'neq', 'in', 'gte', 'lte', 'or', 'limit', 'single', 'ilike', 'insert', 'update', 'delete']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: any) => resolve({ data: resolvedData, error: null })
  return chain
}

function mockSupabase(resolvedData: unknown = supplierData) {
  const chain = makeChainableMock(resolvedData)
  const mock = {
    from: vi.fn().mockReturnValue(chain),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return { mock, chain }
}

function makeRequest(path: string = '/api/suppliers', params: string = '') {
  return new NextRequest(`http://localhost${path}${params ? '?' + params : ''}`)
}

describe('GET /api/suppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns suppliers with flattened category fields', async () => {
    mockSupabase()
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].category_name).toBe('Programvara')
    expect(body.data[0].category_emoji).toBe('💻')
    expect(body.data[0].categories).toBeUndefined()
  })

  it('applies inactive filter', async () => {
    const { chain } = mockSupabase()
    await GET(makeRequest('/api/suppliers', 'filter=inactive'))

    expect(chain.eq).toHaveBeenCalledWith('is_active', false)
  })
})

describe('POST /api/suppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('creates supplier and returns 201', async () => {
    const newSupplier = { id: 'sup-2', name: 'Ny Leverantör AB' }
    const { chain } = mockSupabase(newSupplier)
    vi.mocked(validateBody).mockReturnValue({ data: { name: 'Ny Leverantör AB' } })

    const req = new NextRequest('http://localhost/api/suppliers', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ny Leverantör AB' }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.name).toBe('Ny Leverantör AB')
    expect(chain.insert).toHaveBeenCalledWith({ name: 'Ny Leverantör AB' })
  })
})

describe('PUT /api/suppliers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('updates supplier', async () => {
    const updated = { id: 'sup-1', name: 'Updated AB' }
    const { chain } = mockSupabase(updated)
    vi.mocked(validateBody).mockReturnValue({ data: { name: 'Updated AB' } })

    const req = new NextRequest('http://localhost/api/suppliers/sup-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated AB' }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'sup-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Updated AB')
    expect(chain.update).toHaveBeenCalledWith({ name: 'Updated AB' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'sup-1')
  })

  it('propagates category_id to documents', async () => {
    const updated = { id: 'sup-1', name: 'Fortnox AB', category_id: 'cat-2' }
    const { mock, chain } = mockSupabase(updated)
    vi.mocked(validateBody).mockReturnValue({ data: { category_id: 'cat-2' } })

    const req = new NextRequest('http://localhost/api/suppliers/sup-1', {
      method: 'PUT',
      body: JSON.stringify({ category_id: 'cat-2' }),
    })

    await PUT(req, { params: Promise.resolve({ id: 'sup-1' }) })

    // Should also update documents with the new category_id
    expect(mock.from).toHaveBeenCalledWith('documents')
    expect(chain.update).toHaveBeenCalledWith({ category_id: 'cat-2' })
  })
})

describe('DELETE /api/suppliers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('deletes supplier', async () => {
    const { chain } = mockSupabase({ success: true })

    const req = new NextRequest('http://localhost/api/suppliers/sup-1', {
      method: 'DELETE',
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: 'sup-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'sup-1')
  })
})
