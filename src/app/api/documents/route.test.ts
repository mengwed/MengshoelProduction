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

import { GET } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const docData = [
  {
    id: 'doc-1',
    file_name: 'faktura-123.pdf',
    type: 'incoming_invoice',
    invoice_number: '123',
    total: 1500,
    customers: null,
    suppliers: { name: 'Fortnox AB' },
    categories: { name: 'Programvara', emoji: '💻' },
  },
]

function makeChainableMock(resolvedData: unknown = docData) {
  const terminal = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
  // Create a chainable mock where every method returns the same proxy
  const chain: Record<string, any> = {}
  const methods = ['select', 'order', 'eq', 'in', 'gte', 'lte', 'or', 'limit', 'single']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  // The last call in the route is `await query` which resolves the chain
  // We override `then` to make the chain thenable
  chain.then = (resolve: any) => resolve({ data: resolvedData, error: null })
  return chain
}

function mockSupabase(resolvedData: unknown = docData) {
  const chain = makeChainableMock(resolvedData)
  const mock = {
    from: vi.fn().mockReturnValue(chain),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return { mock, chain }
}

function makeRequest(params: string = '') {
  return new NextRequest(`http://localhost/api/documents${params ? '?' + params : ''}`)
}

describe('GET /api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns documents on success', async () => {
    mockSupabase()
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].supplier_name).toBe('Fortnox AB')
    expect(body.data[0].category_emoji).toBe('💻')
  })

  it('flattens joined fields and removes nested objects', async () => {
    mockSupabase()
    const res = await GET(makeRequest())
    const body = await res.json()

    const doc = body.data[0]
    expect(doc.supplier_name).toBe('Fortnox AB')
    expect(doc.customer_name).toBeUndefined()
    expect(doc.category_name).toBe('Programvara')
    // Nested objects should be removed
    expect(doc.suppliers).toBeUndefined()
    expect(doc.customers).toBeUndefined()
    expect(doc.categories).toBeUndefined()
  })

  it('applies type filter for outgoing', async () => {
    const { chain } = mockSupabase()
    await GET(makeRequest('type=outgoing'))

    expect(chain.eq).toHaveBeenCalledWith('type', 'outgoing_invoice')
  })

  it('applies type filter for incoming', async () => {
    const { chain } = mockSupabase()
    await GET(makeRequest('type=incoming'))

    expect(chain.eq).toHaveBeenCalledWith('type', 'incoming_invoice')
  })

  it('applies search filter with ilike', async () => {
    const { chain } = mockSupabase()
    await GET(makeRequest('search=fortnox'))

    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('%fortnox%')
    )
  })

  it('applies month filter', async () => {
    const { chain } = mockSupabase()
    await GET(makeRequest('month=2025-06'))

    expect(chain.gte).toHaveBeenCalledWith('invoice_date', '2025-06-01')
    expect(chain.lte).toHaveBeenCalledWith('invoice_date', '2025-06-31')
  })
})
