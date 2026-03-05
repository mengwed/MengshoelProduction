import Anthropic from '@anthropic-ai/sdk'
import { EXTRACTION_PROMPT } from './prompt'
import type { AIExtractionResult } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function extractFromPDF(
  pdfBase64: string,
  filenameHint?: string
): Promise<AIExtractionResult> {
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
          text: filenameHint
            ? `${EXTRACTION_PROMPT}\n\nFilnamn: ${filenameHint}`
            : EXTRACTION_PROMPT,
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

  const parsed = JSON.parse(textBlock.text) as AIExtractionResult
  return parsed
}
