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

import { PATCH } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const txData = {
  id: 'tx-1',
  matched_document_id: 'doc-1',
  match_confidence: 1.0,
  documents: { file_name: 'faktura.pdf', type: 'incoming_invoice', invoice_number: '123', total: 1500 },
}

function mockSupabase() {
  const mock = {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: txData, error: null }),
          }),
        }),
      }),
    }),
  }
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/bank/transactions/tx-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/bank/transactions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await PATCH(
      makeRequest({ matched_document_id: 'doc-1' }),
      makeParams('tx-1')
    )
    expect(res.status).toBe(401)
  })

  it('matches a transaction to a document', async () => {
    const mock = mockSupabase()
    const res = await PATCH(
      makeRequest({ matched_document_id: 'doc-1' }),
      makeParams('tx-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.matched_document_id).toBe('doc-1')

    // Verify update was called with confidence 1.0 for manual match
    const updateArg = mock.from('bank_transactions').update.mock.calls[0][0]
    expect(updateArg.match_confidence).toBe(1.0)
  })

  it('unlinks a transaction by setting matched_document_id to null', async () => {
    const unlinkData = { ...txData, matched_document_id: null, match_confidence: null, documents: null }
    const mock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: unlinkData, error: null }),
            }),
          }),
        }),
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const res = await PATCH(
      makeRequest({ matched_document_id: null }),
      makeParams('tx-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.matched_document_id).toBeNull()
    expect(body.data.match_confidence).toBeNull()

    // Verify confidence set to null when unlinking
    const updateArg = mock.from('bank_transactions').update.mock.calls[0][0]
    expect(updateArg.match_confidence).toBeNull()
  })

  it('returns 500 on database error', async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const res = await PATCH(
      makeRequest({ matched_document_id: 'doc-1' }),
      makeParams('tx-1')
    )
    expect(res.status).toBe(500)
  })
})
