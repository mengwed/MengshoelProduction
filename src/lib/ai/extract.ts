import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, EXTRACTION_PROMPT } from './prompt'
import { createServiceClient } from '@/lib/supabase/server'
import type { AIExtractionResult } from '@/types'

interface ExtractionContext {
  suppliers?: string[]
  customers?: string[]
  categories?: string[]
  corrections?: string[]
}

const MAX_RETRIES = 2
const RETRY_DELAYS = [1000, 3000]

async function logAICall(params: {
  documentId?: string
  model: string
  promptTokens?: number
  completionTokens?: number
  durationMs: number
  rawResponse?: unknown
  error?: string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('ai_logs').insert({
      document_id: params.documentId || null,
      model: params.model,
      prompt_tokens: params.promptTokens || null,
      completion_tokens: params.completionTokens || null,
      duration_ms: params.durationMs,
      raw_response: params.rawResponse || null,
      error: params.error || null,
    })
  } catch (e) {
    console.error('Failed to log AI call:', e)
  }
}

async function loadCompanySettings(): Promise<{ company_name: string; organization_type: string; owner_name: string | null } | null> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('company_settings')
      .select('company_name, organization_type, owner_name')
      .limit(1)
      .single()
    return data
  } catch {
    return null
  }
}

export async function extractFromPDF(
  pdfBase64: string,
  filenameHint?: string,
  context?: ExtractionContext
): Promise<AIExtractionResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  // Load company settings for dynamic prompt
  const settings = await loadCompanySettings()
  const basePrompt = settings ? buildPrompt(settings) : EXTRACTION_PROMPT

  // Build context section
  let contextSection = ''

  if (context?.customers?.length) {
    contextSection += `\n\nBEFINTLIGA KUNDER (matcha mot dessa om mojligt):\n${context.customers.join(', ')}`
  }

  if (context?.suppliers?.length) {
    contextSection += `\n\nBEFINTLIGA LEVERANTORER (matcha counterpart_name mot dessa om mojligt):\n${context.suppliers.join(', ')}`
  }

  if (context?.categories?.length) {
    contextSection += `\n\nBEFINTLIGA KATEGORIER:\n${context.categories.join(', ')}`
  }

  if (context?.corrections?.length) {
    contextSection += `\n\nTIDIGARE KORRIGERINGAR (lar dig av dessa - anvandaren har rattat AI:ns klassificering):\n${context.corrections.join('\n')}`
  }

  const fullPrompt = filenameHint
    ? `${basePrompt}${contextSection}\n\nFilnamn: ${filenameHint}`
    : `${basePrompt}${contextSection}`

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          type: 'text',
          text: fullPrompt,
        },
      ],
    },
  ]

  const model = 'claude-haiku-4-5-20251001'
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]))
    }

    const startTime = Date.now()

    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        messages,
      })

      const durationMs = Date.now() - startTime

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from AI')
      }

      // Strip markdown code fences if present
      let jsonText = textBlock.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }

      const parsed = JSON.parse(jsonText) as AIExtractionResult

      // Log successful call (fire and forget)
      logAICall({
        model,
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
        durationMs,
        rawResponse: parsed,
      })

      return parsed
    } catch (err) {
      const durationMs = Date.now() - startTime
      lastError = err instanceof Error ? err : new Error(String(err))

      // Log failed call
      logAICall({
        model,
        durationMs,
        error: lastError.message,
      })

      // Don't retry auth errors — they won't resolve
      if (lastError.message.includes('authentication') || lastError.message.includes('invalid x-api-key')) {
        throw lastError
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`AI extraction attempt ${attempt + 1} failed, retrying...`, lastError.message)
      }
    }
  }

  throw lastError || new Error('AI extraction failed after retries')
}
