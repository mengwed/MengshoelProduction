import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

export interface UnmatchedTransaction {
  index: number
  booking_date: string
  transaction_type: string | null
  reference: string | null
  amount: number
}

export interface DocumentSummary {
  id: string
  type: string
  invoice_number: string | null
  invoice_date: string | null
  amount: number | null
  vat: number | null
  total: number | null
  supplier_name: string | null
  customer_name: string | null
}

export interface AIMatchSuggestion {
  transactionIndex: number
  documentId: string | null
  confidence: number
  explanation: string
}

export function buildMatchPrompt(
  transactions: UnmatchedTransaction[],
  documents: DocumentSummary[]
): string {
  const txList = transactions.map((tx, i) =>
    `  ${i}. Datum: ${tx.booking_date}, Typ: ${tx.transaction_type || '-'}, Referens: ${tx.reference || '-'}, Belopp: ${tx.amount}`
  ).join('\n')

  const docList = documents.map(doc =>
    `  - ID: ${doc.id}, Typ: ${doc.type}, Fakturanr: ${doc.invoice_number || '-'}, Datum: ${doc.invoice_date || '-'}, Belopp: ${doc.amount ?? '-'}, Moms: ${doc.vat ?? '-'}, Totalt: ${doc.total ?? '-'}, Leverantör: ${doc.supplier_name || '-'}, Kund: ${doc.customer_name || '-'}`
  ).join('\n')

  return `Du är en bokföringsassistent. Matcha banktransaktioner mot dokument (fakturor, kvitton etc).

BANKTRANSAKTIONER:
${txList}

DOKUMENT:
${docList}

INSTRUKTIONER:
- Matcha varje transaktion mot det bästa dokumentet baserat på belopp, datum, referens, leverantörs-/kundnamn.
- Inbetalningar (positivt belopp) matchar oftast kundfakturor (outgoing_invoice).
- Utbetalningar (negativt belopp) matchar oftast leverantörsfakturor (incoming_invoice), kvitton etc.
- Kontrollera om transaktionsbeloppet matchar dokumentets totalt (inkl moms).
- Ange confidence 0-1 och en kort förklaring på svenska.
- Om ingen match finns, sätt documentId till null och förklara varför.

Svara ENBART med en JSON-array (inga kommentarer, ingen markdown):
[
  { "transactionIndex": 0, "documentId": "doc-id-or-null", "confidence": 0.95, "explanation": "Kort förklaring" }
]`
}

export function parseMatchResponse(
  responseText: string,
  _transactions: UnmatchedTransaction[]
): AIMatchSuggestion[] {
  try {
    // Strip markdown code block if present
    let text = responseText.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    return parsed.map((item: Record<string, unknown>) => ({
      transactionIndex: Number(item.transactionIndex),
      documentId: (item.documentId as string) ?? null,
      confidence: Number(item.confidence) || 0,
      explanation: String(item.explanation || ''),
    }))
  } catch {
    return []
  }
}

export async function aiMatchTransactions(
  transactions: UnmatchedTransaction[],
  documents: DocumentSummary[]
): Promise<{ suggestions: AIMatchSuggestion[]; error?: string }> {
  if (transactions.length === 0) {
    return { suggestions: [] }
  }

  const prompt = buildMatchPrompt(transactions, documents)
  const startTime = Date.now()

  try {
    const anthropic = new Anthropic()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')

    const suggestions = parseMatchResponse(responseText, transactions)
    const durationMs = Date.now() - startTime

    // Log to ai_logs
    try {
      const supabase = createServiceClient()
      await supabase.from('ai_logs').insert({
        model: 'claude-haiku-4-5-20251001',
        prompt_tokens: response.usage?.input_tokens ?? null,
        completion_tokens: response.usage?.output_tokens ?? null,
        duration_ms: durationMs,
        raw_response: { text: responseText },
      })
    } catch {
      // Logging failure should not break the flow
    }

    return { suggestions }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown AI error'
    return { suggestions: [], error: message }
  }
}
