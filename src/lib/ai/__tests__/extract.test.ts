import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('../prompt', () => ({
  EXTRACTION_PROMPT: 'test prompt',
  buildPrompt: vi.fn().mockReturnValue('built prompt'),
}))

import { extractFromPDF } from '../extract'
import { createServiceClient } from '@/lib/supabase/server'

const mockResult = {
  type: 'incoming_invoice',
  counterpart_name: 'Supplier AB',
  invoice_number: '12345',
  invoice_date: '2025-01-15',
  due_date: '2025-02-15',
  amount: 1000,
  vat: 250,
  total: 1250,
  confidence: 85,
  needs_review: false,
}

const mockAPIResponse = {
  content: [{ type: 'text', text: JSON.stringify(mockResult) }],
  usage: { input_tokens: 100, output_tokens: 50 },
}

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            company_name: 'Test AB',
            organization_type: 'company',
            owner_name: null,
          },
        }),
      }),
    }),
  }),
}

describe('extractFromPDF', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    mockCreate.mockReset()
    mockCreate.mockResolvedValue(mockAPIResponse)
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns parsed AI result on success', async () => {
    const result = await extractFromPDF('base64pdf')

    expect(result).toEqual(mockResult)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('strips markdown code fences from response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockResult) + '\n```' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result = await extractFromPDF('base64pdf')

    expect(result).toEqual(mockResult)
  })

  it('includes context in prompt when provided', async () => {
    await extractFromPDF('base64pdf', 'invoice.pdf', {
      suppliers: ['Supplier AB', 'Vendor XY'],
      customers: ['Customer 1'],
      categories: ['Kontorsmaterial', 'Resor'],
      corrections: ['Supplier AB: incoming_invoice -> expense'],
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0]
    const textContent = callArgs.messages[0].content.find(
      (b: { type: string }) => b.type === 'text'
    )

    expect(textContent.text).toContain('Supplier AB')
    expect(textContent.text).toContain('Vendor XY')
    expect(textContent.text).toContain('Customer 1')
    expect(textContent.text).toContain('Kontorsmaterial')
    expect(textContent.text).toContain('incoming_invoice -> expense')
    expect(textContent.text).toContain('invoice.pdf')
  })

  it('throws immediately on auth errors (no retry)', async () => {
    mockCreate.mockRejectedValue(new Error('invalid x-api-key'))

    await expect(extractFromPDF('base64pdf')).rejects.toThrow('invalid x-api-key')
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('retries on non-auth errors', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockRejectedValueOnce(new Error('server error'))
      .mockResolvedValueOnce(mockAPIResponse)

    const resultPromise = extractFromPDF('base64pdf')

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)

    const result = await resultPromise

    expect(result).toEqual(mockResult)
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })
})
