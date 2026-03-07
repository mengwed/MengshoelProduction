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

vi.mock('@/lib/rate-limit-instances', () => ({
  uploadLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
}))

vi.mock('@/lib/bank/parsers', () => ({
  parseBank: vi.fn(),
}))

vi.mock('@/lib/bank/match', () => ({
  matchTransactions: vi.fn(),
}))

vi.mock('@/lib/bank/ai-match', () => ({
  aiMatchTransactions: vi.fn(),
}))

import { POST } from './route'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadLimiter } from '@/lib/rate-limit-instances'
import { parseBank } from '@/lib/bank/parsers'
import { matchTransactions } from '@/lib/bank/match'
import { aiMatchTransactions } from '@/lib/bank/ai-match'

const sampleTransaction = {
  booking_date: '2025-01-15',
  transaction_date: '2025-01-15',
  transaction_type: 'Betalning',
  reference: 'ref1',
  amount: -500,
  balance: 9500,
}

const fiscalYearData = {
  id: 'fy-1',
  year: 2025,
  is_active: true,
}

function makeChainableMock(responseMap: Record<string, { data: unknown; error: unknown }>) {
  const fromMock = vi.fn().mockImplementation((table: string) => {
    const response = responseMap[table] || { data: null, error: null }
    const chain: Record<string, any> = {}
    const methods = ['select', 'eq', 'in', 'gte', 'lte', 'or', 'order', 'limit', 'single', 'ilike', 'insert']
    for (const method of methods) {
      if (method === 'insert') {
        chain[method] = vi.fn().mockResolvedValue(response)
      } else {
        chain[method] = vi.fn().mockReturnValue(chain)
      }
    }
    chain.then = (resolve: any) => resolve(response)
    return chain
  })
  return { from: fromMock }
}

function mockSupabase(overrides: Partial<Record<string, { data: unknown; error: unknown }>> = {}) {
  const responseMap: Record<string, { data: unknown; error: unknown }> = {
    fiscal_years: { data: fiscalYearData, error: null },
    bank_transactions: { data: [], error: null },
    documents: { data: [], error: null },
    ...overrides,
  }
  const mock = makeChainableMock(responseMap)
  vi.mocked(createServiceClient).mockReturnValue(mock as any)
  return mock
}

// jsdom's Request.formData() hangs with File bodies, so we mock it
function makeRequest(file?: File) {
  const mockFormData = new FormData()
  if (file) {
    mockFormData.append('file', file)
  }
  const req = new Request('http://localhost/api/bank/import', {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
  vi.spyOn(req, 'formData').mockResolvedValue(mockFormData)
  return req
}

function makeFile() {
  return new File(['data'], 'bank.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('POST /api/bank/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1' } as any)
    vi.mocked(uploadLimiter.check).mockReturnValue({ allowed: true } as any)
  })

  it('returns 401 without auth', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth')).AuthError())

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(uploadLimiter.check).mockReturnValue({ allowed: false } as any)

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(429)
  })

  it('returns 400 when no file provided', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No file provided')
  })

  it('returns 400 when no active fiscal year', async () => {
    mockSupabase({
      fiscal_years: { data: null, error: null },
    })
    vi.mocked(parseBank).mockReturnValue({ transactions: [sampleTransaction] } as any)

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No active fiscal year')
  })

  it('returns 400 when no transactions found in file', async () => {
    mockSupabase()
    vi.mocked(parseBank).mockReturnValue({ transactions: [] } as any)

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Inga transaktioner')
  })

  it('imports transactions successfully with counts', async () => {
    mockSupabase()
    vi.mocked(parseBank).mockReturnValue({
      transactions: [sampleTransaction],
    } as any)
    vi.mocked(matchTransactions).mockResolvedValue([
      {
        transaction: sampleTransaction,
        matched_document_id: 'doc-1',
        match_confidence: 0.9,
      },
    ] as any)
    vi.mocked(aiMatchTransactions).mockResolvedValue({
      suggestions: [],
      error: null,
    } as any)

    const res = await POST(makeRequest(makeFile()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.imported).toBe(1)
    expect(body.data.rule_matched).toBe(1)
    expect(body.data.ai_matched).toBe(0)
    expect(body.data.unmatched).toBe(0)
    expect(body.data.duplicates).toBe(0)
  })

  it('detects and skips duplicate transactions', async () => {
    mockSupabase({
      bank_transactions: {
        data: [
          { booking_date: '2025-01-15', amount: -500, reference: 'ref1' },
        ],
        error: null,
      },
    })
    vi.mocked(parseBank).mockReturnValue({
      transactions: [sampleTransaction],
    } as any)

    const res = await POST(makeRequest(makeFile()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.imported).toBe(0)
    expect(body.data.duplicates).toBe(1)
  })
})
