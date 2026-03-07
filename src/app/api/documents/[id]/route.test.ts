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
  documentUpdateSchema: {},
  validateBody: vi.fn(),
}))

import { PUT, DELETE } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/validations'

const docData = {
  id: 'doc-1',
  type: 'incoming_invoice',
  file_name: 'faktura.pdf',
  category_id: null,
  supplier_id: null,
  customer_id: null,
}

const currentDoc = {
  ...docData,
  customers: null,
  suppliers: { name: 'Leverantor AB' },
  fiscal_year_id: null,
  invoice_date: null,
}

function makeRequest(body: Record<string, unknown>, method = 'PUT') {
  return new Request('http://localhost/api/documents/doc-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Build a supabase mock that handles both the "load current doc" select chain
// and the "update" chain, plus side-effect calls (insert, update on other tables).
function mockSupabase(overrides?: {
  currentDoc?: Record<string, unknown> | null
  updateResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
}) {
  const current = overrides?.currentDoc ?? currentDoc
  const updateResult = overrides?.updateResult ?? { data: docData, error: null }

  const selectSingle = vi.fn().mockResolvedValue({ data: current, error: null })
  const updateSingle = vi.fn().mockResolvedValue(updateResult)

  // Generic chain that resolves to { data: null, error: null } for side-effect calls
  const genericChain = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }

  let fromCallCount = 0
  const mock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'documents') {
        fromCallCount++
        // First call: load current doc (select chain)
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: selectSingle,
              }),
            }),
          }
        }
        // Later document calls: update chain or side-effect
        return {
          ...genericChain,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ...genericChain,
              select: vi.fn().mockReturnValue({
                single: updateSingle,
              }),
            }),
          }),
        }
      }
      // Other tables (ai_corrections, suppliers, fiscal_years)
      return genericChain
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }

  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

function mockDeleteSupabase(overrides?: {
  doc?: { file_path: string } | null
  deleteError?: { message: string } | null
}) {
  const doc = overrides?.doc ?? { file_path: 'uploads/faktura.pdf' }
  const deleteError = overrides?.deleteError ?? null

  const mock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: doc, error: null }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: deleteError }),
          }),
        }
      }
      return {}
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }

  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

describe('PUT /api/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await PUT(
      makeRequest({ type: 'incoming_invoice' }),
      makeParams('doc-1')
    )
    expect(res.status).toBe(401)
  })

  it('returns validation error on bad body', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 })
    vi.mocked(validateBody).mockReturnValue({ error: errorResponse } as any)
    mockSupabase()

    const res = await PUT(
      makeRequest({ bad: 'data' }),
      makeParams('doc-1')
    )
    expect(res.status).toBe(400)
  })

  it('updates document and returns 200', async () => {
    vi.mocked(validateBody).mockReturnValue({ data: { type: 'incoming_invoice' } } as any)
    mockSupabase()

    const res = await PUT(
      makeRequest({ type: 'incoming_invoice' }),
      makeParams('doc-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('doc-1')
  })

  it('returns 500 on database error', async () => {
    vi.mocked(validateBody).mockReturnValue({ data: { type: 'incoming_invoice' } } as any)
    mockSupabase({
      updateResult: { data: null, error: { message: 'DB error' } },
    })

    const res = await PUT(
      makeRequest({ type: 'incoming_invoice' }),
      makeParams('doc-1')
    )
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await DELETE(
      new Request('http://localhost/api/documents/doc-1', { method: 'DELETE' }),
      makeParams('doc-1')
    )
    expect(res.status).toBe(401)
  })

  it('deletes file from storage and document from DB', async () => {
    const mock = mockDeleteSupabase()

    const res = await DELETE(
      new Request('http://localhost/api/documents/doc-1', { method: 'DELETE' }),
      makeParams('doc-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)
    expect(mock.storage.from).toHaveBeenCalledWith('documents')
  })

  it('returns 500 on database error', async () => {
    mockDeleteSupabase({ deleteError: { message: 'DB error' } })

    const res = await DELETE(
      new Request('http://localhost/api/documents/doc-1', { method: 'DELETE' }),
      makeParams('doc-1')
    )
    expect(res.status).toBe(500)
  })
})
