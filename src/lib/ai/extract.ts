import Anthropic from '@anthropic-ai/sdk'
import { EXTRACTION_PROMPT } from './prompt'
import type { AIExtractionResult } from '@/types'

interface ExtractionContext {
  suppliers?: string[]
  customers?: string[]
  categories?: string[]
  corrections?: string[]
}

export async function extractFromPDF(
  pdfBase64: string,
  filenameHint?: string,
  context?: ExtractionContext
): Promise<AIExtractionResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  // Build context section
  let contextSection = ''

  if (context?.customers?.length) {
    contextSection += `\n\nBEFINTLIGA KUNDER (matcha mot dessa om möjligt):\n${context.customers.join(', ')}`
  }

  if (context?.suppliers?.length) {
    contextSection += `\n\nBEFINTLIGA LEVERANTÖRER (matcha counterpart_name mot dessa om möjligt):\n${context.suppliers.join(', ')}`
  }

  if (context?.categories?.length) {
    contextSection += `\n\nBEFINTLIGA KATEGORIER:\n${context.categories.join(', ')}`
  }

  if (context?.corrections?.length) {
    contextSection += `\n\nTIDIGARE KORRIGERINGAR (lär dig av dessa - användaren har rättat AI:ns klassificering):\n${context.corrections.join('\n')}`
  }

  const fullPrompt = filenameHint
    ? `${EXTRACTION_PROMPT}${contextSection}\n\nFilnamn: ${filenameHint}`
    : `${EXTRACTION_PROMPT}${contextSection}`

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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages,
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI')
  }

  // Strip markdown code fences if present (```json ... ```)
  let jsonText = textBlock.text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(jsonText) as AIExtractionResult
  return parsed
}
