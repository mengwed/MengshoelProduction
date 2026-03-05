# AI Improvements, Bank Reconciliation & New Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement dynamic AI prompts, AI logging/retry, bank reconciliation confidence scoring with generic parser architecture, manual matching, and fulltext search.

**Architecture:** Extends existing Next.js App Router API routes and Supabase tables. New `company_settings` and `ai_logs` tables. Bank parser refactored into pluggable architecture under `src/lib/bank/parsers/`. Search via server-side ILIKE queries with JOINs.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Supabase, Anthropic SDK, Framer Motion, Vitest

---

### Task 1: Database migrations — company_settings and ai_logs tables

**Files:**
- Create: `supabase/migrations/003_company_settings.sql`
- Create: `supabase/migrations/004_ai_logs.sql`
- Create: `supabase/migrations/005_bank_match_confidence.sql`

**Step 1: Create company_settings migration**

Create `supabase/migrations/003_company_settings.sql`:
```sql
CREATE TABLE company_settings (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  organization_type TEXT NOT NULL DEFAULT 'enskild firma',
  owner_name TEXT,
  industry TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON company_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with current company
INSERT INTO company_settings (company_name, organization_type, owner_name)
VALUES ('Mengshoel Production', 'enskild firma', 'Anne Juul Mengshoel');
```

**Step 2: Create ai_logs migration**

Create `supabase/migrations/004_ai_logs.sql`:
```sql
CREATE TABLE ai_logs (
  id SERIAL PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,
  raw_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON ai_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_logs_document ON ai_logs(document_id);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
```

**Step 3: Create bank match_confidence migration**

Create `supabase/migrations/005_bank_match_confidence.sql`:
```sql
ALTER TABLE bank_transactions ADD COLUMN match_confidence DECIMAL(3,2);
```

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add migrations for company_settings, ai_logs, and bank match_confidence"
```

---

### Task 2: Types — add CompanySettings, AILog, update BankTransaction

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types to `src/types/index.ts`**

Add after the existing `CategoryInput` interface (~line 152):
```typescript
export interface CompanySettings {
  id: number
  company_name: string
  organization_type: string
  owner_name: string | null
  industry: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettingsInput {
  company_name: string
  organization_type: string
  owner_name?: string | null
  industry?: string | null
  notes?: string | null
}

export interface AILog {
  id: number
  document_id: string | null
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  duration_ms: number | null
  raw_response: Record<string, unknown> | null
  error: string | null
  created_at: string
}
```

Also add `match_confidence` to the existing `BankTransaction` interface (~line 95):
```typescript
// Add after matched_document_id line:
match_confidence: number | null
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add CompanySettings, AILog types and match_confidence to BankTransaction"
```

---

### Task 3: Dynamic AI prompt — buildPrompt function

**Files:**
- Modify: `src/lib/ai/prompt.ts`
- Create: `src/lib/ai/__tests__/prompt.test.ts`

**Step 1: Write test for buildPrompt**

Create `src/lib/ai/__tests__/prompt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../prompt'

describe('buildPrompt', () => {
  it('should include company name in prompt', () => {
    const prompt = buildPrompt({
      company_name: 'TestCo AB',
      organization_type: 'aktiebolag',
      owner_name: 'Test Person',
    })
    expect(prompt).toContain('TestCo AB')
    expect(prompt).toContain('aktiebolag')
    expect(prompt).toContain('Test Person')
    expect(prompt).not.toContain('Mengshoel Production')
  })

  it('should use defaults for missing optional fields', () => {
    const prompt = buildPrompt({
      company_name: 'MinFirma',
      organization_type: 'enskild firma',
      owner_name: null,
    })
    expect(prompt).toContain('MinFirma')
    expect(prompt).toContain('enskild firma')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/prompt.test.ts`
Expected: FAIL — `buildPrompt` does not exist yet.

**Step 3: Rewrite prompt.ts to export buildPrompt**

Replace the entire content of `src/lib/ai/prompt.ts`:
```typescript
interface PromptSettings {
  company_name: string
  organization_type: string
  owner_name: string | null
}

export function buildPrompt(settings: PromptSettings): string {
  const { company_name, organization_type, owner_name } = settings
  const ownerPart = owner_name ? `, ${owner_name}` : ''

  return `Du ar en AI-assistent som analyserar svenska bokforingsdokument (PDF) for foretaget "${company_name}" (${organization_type}${ownerPart}).

Analysera detta dokument och extrahera foljande information.

FORETAGSIDENTITET - DETTA AR KRITISKT:
Dokumenten tillhor bokforingen for "${company_name}". Du MASTE avgora relationen:
- Om ${company_name} har UTFORT arbete/tjanst och ska FA BETALT -> type = "outgoing_invoice"
- Om ${company_name} ska BETALA for nagot (vara, tjanst, avgift, skatt, kvitto, abonnemang) -> type = "incoming_invoice"

SJALVFAKTUROR (viktigt!):
Ibland skapar KUNDEN (t.ex. SVT, UR, TV4) fakturadokumentet at ${company_name}. Dokumentet ser ut att komma FRAN kunden, men det ar egentligen en betalning TILL ${company_name} for utfort arbete. Tecken pa sjalvfaktura:
- ${company_name} star som "leverantor" eller i ett leverantorsfalt
- Det finns ett leverantorsnummer kopplat till ${company_name}
- Stora medieforetag (SVT, UR, TV4) star som dokumentskapare men ${company_name} ar mottagare av betalningen
-> Dessa ska vara type = "outgoing_invoice", counterpart_name = kundens namn (t.ex. "Sveriges Television AB")

TYPBESTAMNING (bara 4 typer):
1. outgoing_invoice: ${company_name} fakturerar en kund, eller en sjalvfaktura dar ${company_name} far betalt
2. incoming_invoice: ALLT som ${company_name} betalar for. Inkluderar:
   - Leverantorsfakturor (Fortnox, InExchange, etc.)
   - Myndighetsavgifter (Transportstyrelsen, Skatteverket - trangselskatt, fordonsskatt, etc.)
   - Kvitton (parkering, mat, programvara, etc.)
   - Abonnemang (telefon, forsakring, etc.)
   - Alla andra kostnader
3. loan_statement: ENBART laneaviseringar (amortering + ranta pa bolan/billan)
4. credit_card_statement: ENBART kontoutdrag med FLERA transaktioner listade

Om du ar osaker mellan incoming_invoice och en annan typ: valj incoming_invoice.

MOTPART (counterpart_name):
- For outgoing_invoice: Ange KUNDENS namn (den som betalar ${company_name})
- For incoming_invoice: Ange LEVERANTORENS/MYNDIGHETENS namn (den ${company_name} betalar)
- Anvand det fullstandiga foretagsnamnet, t.ex. "Sveriges Television AB" (inte "SVT Leverantorsfakturor"), "Transportstyrelsen" (inte "TSM")

MOMSREGLER:
- Extrahera BARA moms om den tydligt framgar i dokumentet
- Myndighetsavgifter (trangselskatt, fordonsskatt) har ALDRIG moms
- Laneaviseringar har ALDRIG moms
- Om moms inte tydligt framgar, satt vat och vat_rate till null
- GISSA ALDRIG momsbelopp

For kontoutdrag (credit_card_statement): extrahera VARJE transaktion som en separat rad i "lines".

Svara ENBART med giltig JSON (ingen markdown, inga kodblock) i detta format:
{
  "type": "outgoing_invoice|incoming_invoice|loan_statement|credit_card_statement",
  "invoice_number": "fakturanummer eller null",
  "invoice_date": "YYYY-MM-DD eller null",
  "due_date": "YYYY-MM-DD eller null",
  "amount": 0.00 (belopp exkl moms, eller null),
  "vat": 0.00 (momsbelopp, eller null),
  "vat_rate": 25 (momssats i procent, eller null),
  "total": 0.00 (belopp inkl moms),
  "counterpart_name": "namn pa kund eller leverantor",
  "counterpart_org_number": "organisationsnummer eller null",
  "confidence": 85 (0-100, hur saker du ar),
  "needs_review": false,
  "review_reasons": [],
  "lines": null (eller array av rader for kontoutdrag)
}

For "lines" (kontoutdrag), anvand detta format:
"lines": [
  { "date": "YYYY-MM-DD", "description": "beskrivning", "amount": -100.00 }
]`
}

// Fallback for backwards compatibility — used if settings can't be loaded
export const EXTRACTION_PROMPT = buildPrompt({
  company_name: 'Mengshoel Production',
  organization_type: 'enskild firma',
  owner_name: 'Anne Juul Mengshoel',
})
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/prompt.ts src/lib/ai/__tests__/prompt.test.ts
git commit -m "feat: make AI prompt dynamic with buildPrompt function"
```

---

### Task 4: AI amount validation

**Files:**
- Create: `src/lib/ai/validate.ts`
- Create: `src/lib/ai/__tests__/validate.test.ts`

**Step 1: Write tests**

Create `src/lib/ai/__tests__/validate.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { validateExtractionResult } from '../validate'

describe('validateExtractionResult', () => {
  const base = {
    type: 'incoming_invoice' as const,
    invoice_number: '123',
    invoice_date: '2025-01-01',
    due_date: '2025-02-01',
    amount: 1000,
    vat: 250,
    vat_rate: 25,
    total: 1250,
    counterpart_name: 'Test AB',
    counterpart_org_number: null,
    confidence: 90,
    needs_review: false,
    review_reasons: [],
    lines: null,
  }

  it('should pass valid result unchanged', () => {
    const result = validateExtractionResult(base)
    expect(result.needs_review).toBe(false)
    expect(result.review_reasons).toEqual([])
  })

  it('should flag amount over 100M SEK', () => {
    const result = validateExtractionResult({ ...base, total: 200_000_000 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Unusually high amount')
  })

  it('should flag negative amount on invoice', () => {
    const result = validateExtractionResult({ ...base, amount: -500 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Negative amount on invoice')
  })

  it('should flag total != amount + vat mismatch', () => {
    const result = validateExtractionResult({ ...base, amount: 1000, vat: 250, total: 1500 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Total does not match amount + VAT')
  })

  it('should not flag when vat is null', () => {
    const result = validateExtractionResult({ ...base, vat: null, vat_rate: null, total: 1000 })
    expect(result.needs_review).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/validate.test.ts`
Expected: FAIL

**Step 3: Implement validate.ts**

Create `src/lib/ai/validate.ts`:
```typescript
import type { AIExtractionResult } from '@/types'

const MAX_AMOUNT_SEK = 100_000_000

export function validateExtractionResult(result: AIExtractionResult): AIExtractionResult {
  const issues: string[] = [...result.review_reasons]

  // Check for unreasonably high amounts
  const amounts = [result.amount, result.vat, result.total].filter((a): a is number => a !== null)
  if (amounts.some(a => Math.abs(a) > MAX_AMOUNT_SEK)) {
    issues.push('Unusually high amount')
  }

  // Check for negative amounts on invoices
  if (result.amount !== null && result.amount < 0 &&
      (result.type === 'incoming_invoice' || result.type === 'outgoing_invoice')) {
    issues.push('Negative amount on invoice')
  }

  // Check total = amount + vat
  if (result.amount !== null && result.vat !== null && result.total !== null) {
    const expectedTotal = result.amount + result.vat
    if (Math.abs(result.total - expectedTotal) > 1) {
      issues.push('Total does not match amount + VAT')
    }
  }

  return {
    ...result,
    needs_review: result.needs_review || issues.length > result.review_reasons.length,
    review_reasons: issues,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/validate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/validate.ts src/lib/ai/__tests__/validate.test.ts
git commit -m "feat: add AI extraction amount validation"
```

---

### Task 5: AI logging and retry in extract.ts

**Files:**
- Modify: `src/lib/ai/extract.ts`

**Step 1: Rewrite extract.ts with logging and retry**

Replace `src/lib/ai/extract.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, EXTRACTION_PROMPT } from './prompt'
import { createServiceClient } from '@/lib/supabase/server'
import type { AIExtractionResult, CompanySettings } from '@/types'

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

      if (attempt < MAX_RETRIES) {
        console.warn(`AI extraction attempt ${attempt + 1} failed, retrying...`, lastError.message)
      }
    }
  }

  throw lastError || new Error('AI extraction failed after retries')
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/extract.ts
git commit -m "feat: add AI logging and retry with exponential backoff"
```

---

### Task 6: Update upload route — validation + graceful failure

**Files:**
- Modify: `src/app/api/documents/upload/route.ts`

**Step 1: Update upload route**

In `src/app/api/documents/upload/route.ts`, add import at top:
```typescript
import { validateExtractionResult } from '@/lib/ai/validate'
```

Then modify the AI extraction block (lines 100-112). Replace:
```typescript
    // AI extraction
    let aiResult
    try {
      const base64 = Buffer.from(fileBuffer).toString('base64')
      aiResult = await extractFromPDF(base64, file.name, context)
      // Sanitize AI output to prevent XSS
      aiResult = sanitizeObject(aiResult)
    } catch (err) {
      console.error('AI extraction error:', err)
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([filePath])
      return apiError('AI extraction failed. Please try again later.', 503)
    }
```

With:
```typescript
    // AI extraction with validation
    let aiResult
    try {
      const base64 = Buffer.from(fileBuffer).toString('base64')
      aiResult = await extractFromPDF(base64, file.name, context)
      aiResult = sanitizeObject(aiResult)
      aiResult = validateExtractionResult(aiResult)
    } catch (err) {
      console.error('AI extraction error:', err)
      // Create document with empty extraction instead of deleting the file
      const { data: doc, error: insertError } = await supabase
        .from('documents')
        .insert({
          type: 'other',
          fiscal_year_id: fiscalYear.id,
          file_path: filePath,
          file_name: file.name,
          ai_extracted_data: null,
          ai_confidence: 0,
          ai_needs_review: true,
          status: 'imported',
        })
        .select()
        .single()

      if (insertError) {
        await supabase.storage.from('documents').remove([filePath])
        return apiError(insertError.message, 500)
      }

      return apiSuccess({
        ...doc,
        warning: 'AI-extraktion misslyckades. Dokumentet sparades men behover granskas manuellt.',
      }, 201)
    }
```

Also in the auto-categorization section (~line 199-208), add the confidence boost:
```typescript
    // Auto-assign category from supplier if available
    let categoryId: number | null = null
    if (supplierId) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('category_id')
        .eq('id', supplierId)
        .single()
      if (supplierData?.category_id) {
        categoryId = supplierData.category_id
        // Boost confidence when we have confirmed supplier category
        if (aiResult.confidence < 100) {
          aiResult.confidence = Math.min(100, aiResult.confidence + 5)
        }
      }
    }
```

**Step 2: Commit**

```bash
git add src/app/api/documents/upload/route.ts
git commit -m "feat: add amount validation, graceful AI failure, and category confidence boost"
```

---

### Task 7: Company settings API routes

**Files:**
- Create: `src/app/api/settings/route.ts`

**Step 1: Create settings API**

Create `src/app/api/settings/route.ts`:
```typescript
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const body = await request.json()

    // Get existing settings
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single()

    if (existing) {
      const { data, error } = await supabase
        .from('company_settings')
        .update({
          company_name: body.company_name,
          organization_type: body.organization_type,
          owner_name: body.owner_name ?? null,
          industry: body.industry ?? null,
          notes: body.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return apiError(error.message, 500)
      return apiSuccess(data)
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert({
          company_name: body.company_name,
          organization_type: body.organization_type,
          owner_name: body.owner_name ?? null,
          industry: body.industry ?? null,
          notes: body.notes ?? null,
        })
        .select()
        .single()

      if (error) return apiError(error.message, 500)
      return apiSuccess(data, 201)
    }
  } catch (e) {
    return handleApiError(e)
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat: add company settings API routes (GET/PUT)"
```

---

### Task 8: Settings page UI

**Files:**
- Create: `src/app/(app)/installningar/page.tsx`
- Modify: `src/components/Sidebar.tsx`

**Step 1: Create settings page**

Create `src/app/(app)/installningar/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import type { CompanySettings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => setSettings(json.data ?? json))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!settings) return

    setSaving(true)
    setSaved(false)

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: settings.company_name,
        organization_type: settings.organization_type,
        owner_name: settings.owner_name,
        industry: settings.industry,
        notes: settings.notes,
      }),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) return <div className="text-gray-400">Laddar...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Installningar</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Foretagsnamn</label>
          <input
            type="text"
            value={settings.company_name}
            onChange={e => setSettings({ ...settings, company_name: e.target.value })}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Organisationstyp</label>
          <select
            value={settings.organization_type}
            onChange={e => setSettings({ ...settings, organization_type: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="enskild firma">Enskild firma</option>
            <option value="aktiebolag">Aktiebolag</option>
            <option value="handelsbolag">Handelsbolag</option>
            <option value="ekonomisk forening">Ekonomisk forening</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Agare/kontaktperson</label>
          <input
            type="text"
            value={settings.owner_name || ''}
            onChange={e => setSettings({ ...settings, owner_name: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Bransch</label>
          <input
            type="text"
            value={settings.industry || ''}
            onChange={e => setSettings({ ...settings, industry: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Anteckningar</label>
          <textarea
            value={settings.notes || ''}
            onChange={e => setSettings({ ...settings, notes: e.target.value || null })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          {saved && <span className="text-green-400 text-sm">Sparat!</span>}
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Add settings link to Sidebar**

In `src/components/Sidebar.tsx`, add to the `navItems` array (after the kategorier entry, line 17):
```typescript
  { href: '/installningar', label: 'Installningar', icon: '⚙️' },
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/installningar/page.tsx src/components/Sidebar.tsx
git commit -m "feat: add settings page for company configuration"
```

---

### Task 9: Bank matching with confidence scores

**Files:**
- Modify: `src/lib/bank/match.ts`
- Create: `src/lib/bank/__tests__/match.test.ts`

**Step 1: Write tests for confidence-based matching**

Create `src/lib/bank/__tests__/match.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { scoreMatch, CONFIDENCE_THRESHOLD } from '../match'

describe('scoreMatch', () => {
  const baseDoc = {
    id: '1',
    invoice_number: '12345',
    total: 1500,
    amount: 1200,
    invoice_date: '2025-06-15',
    type: 'incoming_invoice',
    suppliers: { name: 'Fortnox AB' },
    customers: null,
  }

  it('should return 0.95 for exact reference match', () => {
    const score = scoreMatch(
      { reference: '12345', amount: -1500, booking_date: '2025-06-20' },
      baseDoc
    )
    expect(score).toBe(0.95)
  })

  it('should return 0.80 for reference containing invoice number', () => {
    const score = scoreMatch(
      { reference: 'BET 12345 REF', amount: -1500, booking_date: '2025-06-20' },
      baseDoc
    )
    expect(score).toBe(0.80)
  })

  it('should return 0.75 for amount + date within 7 days', () => {
    const score = scoreMatch(
      { reference: null, amount: -1500, booking_date: '2025-06-18' },
      baseDoc
    )
    expect(score).toBe(0.75)
  })

  it('should return 0.60 for amount + date within 30 days', () => {
    const score = scoreMatch(
      { reference: null, amount: -1500, booking_date: '2025-07-10' },
      baseDoc
    )
    expect(score).toBe(0.60)
  })

  it('should return 0.70 for supplier name in reference + amount match', () => {
    const score = scoreMatch(
      { reference: 'Fortnox faktura', amount: -1500, booking_date: '2025-08-01' },
      baseDoc
    )
    expect(score).toBe(0.70)
  })

  it('should return 0.40 for supplier name in reference without amount', () => {
    const score = scoreMatch(
      { reference: 'Fortnox faktura', amount: -999, booking_date: '2025-08-01' },
      baseDoc
    )
    expect(score).toBe(0.40)
  })

  it('should return 0 for no match', () => {
    const score = scoreMatch(
      { reference: 'random', amount: -999, booking_date: '2025-12-01' },
      baseDoc
    )
    expect(score).toBe(0)
  })

  it('CONFIDENCE_THRESHOLD should be 0.70', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.70)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bank/__tests__/match.test.ts`
Expected: FAIL

**Step 3: Rewrite match.ts with confidence scoring**

Replace `src/lib/bank/match.ts`:
```typescript
import { createServiceClient } from '@/lib/supabase/server'

export const CONFIDENCE_THRESHOLD = 0.70

interface TransactionInput {
  reference: string | null
  amount: number
  booking_date: string
}

interface DocumentMatch {
  id: string
  invoice_number: string | null
  total: number | null
  amount: number | null
  invoice_date: string | null
  type: string
  suppliers: { name: string } | null
  customers: { name: string } | null
}

export interface MatchResult {
  matched_document_id: string | null
  match_confidence: number | null
  suggested_document_id?: string
  suggested_confidence?: number
}

export function scoreMatch(tx: TransactionInput, doc: DocumentMatch): number {
  // 1. Exact reference match
  if (tx.reference && doc.invoice_number) {
    const refClean = tx.reference.replace(/\D/g, '')
    if (refClean === doc.invoice_number) return 0.95
    if (tx.reference.includes(doc.invoice_number)) return 0.80
  }

  const txAmount = Math.abs(tx.amount)
  const docTotal = Math.abs(doc.total ?? doc.amount ?? 0)
  const amountMatch = docTotal > 0 && Math.abs(txAmount - docTotal) < 0.01

  // 2. Amount + date proximity
  if (amountMatch && doc.invoice_date) {
    const txDate = new Date(tx.booking_date)
    const docDate = new Date(doc.invoice_date)
    const daysDiff = Math.abs((txDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff <= 7) return 0.75
    if (daysDiff <= 30) return 0.60
  }

  // 3. Supplier/customer name in reference
  if (tx.reference) {
    const refLower = tx.reference.toLowerCase()
    const name = doc.suppliers?.name || doc.customers?.name
    if (name && refLower.includes(name.toLowerCase().slice(0, 8))) {
      return amountMatch ? 0.70 : 0.40
    }
  }

  return 0
}

export async function matchTransactions(
  transactions: Array<{ booking_date: string; transaction_date: string | null; transaction_type: string | null; reference: string | null; amount: number; balance: number | null }>,
  fiscalYearId: number
): Promise<Array<{ transaction: typeof transactions[number]; matched_document_id: string | null; match_confidence: number | null }>> {
  const supabase = createServiceClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('id, invoice_number, total, amount, invoice_date, type, suppliers(name), customers(name)')
    .eq('fiscal_year_id', fiscalYearId)

  if (!documents) {
    return transactions.map(t => ({ transaction: t, matched_document_id: null, match_confidence: null }))
  }

  return transactions.map((tx) => {
    let bestId: string | null = null
    let bestScore = 0

    for (const doc of documents) {
      const score = scoreMatch(
        { reference: tx.reference, amount: tx.amount, booking_date: tx.booking_date },
        doc as unknown as DocumentMatch
      )
      if (score > bestScore) {
        bestScore = score
        bestId = doc.id
      }
    }

    if (bestScore >= CONFIDENCE_THRESHOLD) {
      return { transaction: tx, matched_document_id: bestId, match_confidence: bestScore }
    }

    return { transaction: tx, matched_document_id: null, match_confidence: null }
  })
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/bank/__tests__/match.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/bank/match.ts src/lib/bank/__tests__/match.test.ts
git commit -m "feat: add confidence scoring to bank transaction matching"
```

---

### Task 10: Generic bank parser architecture

**Files:**
- Create: `src/lib/bank/parsers/types.ts`
- Create: `src/lib/bank/parsers/swedbank.ts` (move from parse-swedbank.ts)
- Create: `src/lib/bank/parsers/index.ts`
- Modify: `src/app/api/bank/import/route.ts`

**Step 1: Create shared types**

Create `src/lib/bank/parsers/types.ts`:
```typescript
import type * as XLSX from 'xlsx'

export interface ParsedTransaction {
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
}

export interface BankParser {
  name: string
  detect(workbook: XLSX.WorkBook): boolean
  parse(workbook: XLSX.WorkBook): ParsedTransaction[]
}
```

**Step 2: Move Swedbank parser to new location**

Create `src/lib/bank/parsers/swedbank.ts` — same logic as current `parse-swedbank.ts` but implementing the `BankParser` interface:
```typescript
import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from './types'

function parseDate(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim()

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return str

  const euMatch = str.match(/^(\d{2})[./](\d{2})[./](\d{4})$/)
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`

  return null
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const str = String(value).trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')

  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

export const swedbankParser: BankParser = {
  name: 'Swedbank',

  detect(workbook) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return false
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    return rows.some(row =>
      row?.some(cell =>
        typeof cell === 'string' &&
        (cell.includes('Bokforingsdatum') || cell.includes('Bokforingsdag') || cell.includes('Clnr'))
      )
    )
  },

  parse(workbook) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    let headerIndex = -1
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row?.some((cell: string) =>
        typeof cell === 'string' &&
        (cell.includes('Bokforingsdatum') || cell.includes('Bokforingsdag') || cell.includes('Clnr'))
      )) {
        headerIndex = i
        break
      }
    }

    const transactions: ParsedTransaction[] = []
    const startRow = headerIndex + 1

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 5) continue

      const firstCell = String(row[0] ?? '')
      const hasClnr = /^\d+$/.test(firstCell.trim())

      let bookingDate: string | null
      let transactionDate: string | null
      let transactionType: string | null
      let reference: string | null
      let amount: number | null
      let balance: number | null

      if (hasClnr) {
        bookingDate = parseDate(row[1])
        transactionDate = parseDate(row[2])
        transactionType = row[3] ? String(row[3]) : null
        reference = row[4] ? String(row[4]) : null
        amount = parseAmount(row[5])
        balance = parseAmount(row[6])
      } else {
        bookingDate = parseDate(row[0])
        transactionDate = parseDate(row[1])
        transactionType = row[2] ? String(row[2]) : null
        reference = row[3] ? String(row[3]) : null
        amount = parseAmount(row[4])
        balance = parseAmount(row[5])
      }

      if (bookingDate && amount !== null) {
        transactions.push({
          booking_date: bookingDate,
          transaction_date: transactionDate,
          transaction_type: transactionType,
          reference,
          amount,
          balance,
        })
      }
    }

    return transactions
  },
}
```

**Step 3: Create parser registry**

Create `src/lib/bank/parsers/index.ts`:
```typescript
import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from './types'
import { swedbankParser } from './swedbank'

const parsers: BankParser[] = [
  swedbankParser,
]

export function parseBank(buffer: ArrayBuffer): { parser: string; transactions: ParsedTransaction[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })

  for (const parser of parsers) {
    if (parser.detect(workbook)) {
      return {
        parser: parser.name,
        transactions: parser.parse(workbook),
      }
    }
  }

  throw new Error('Okant bankformat. Stodda format: ' + parsers.map(p => p.name).join(', '))
}

export type { ParsedTransaction, BankParser }
```

**Step 4: Update bank import route**

Replace imports and parsing in `src/app/api/bank/import/route.ts`. Change:
```typescript
import { parseSwedbank } from '@/lib/bank/parse-swedbank'
```
To:
```typescript
import { parseBank } from '@/lib/bank/parsers'
```

And change line 41:
```typescript
    const transactions = parseSwedbank(buffer)
```
To:
```typescript
    const { parser: bankName, transactions } = parseBank(buffer)
```

Also update the rows to include match_confidence (line 52-62):
```typescript
    const rows = matched.map((m) => ({
      fiscal_year_id: fiscalYear.id,
      booking_date: m.transaction.booking_date,
      transaction_date: m.transaction.transaction_date,
      transaction_type: m.transaction.transaction_type,
      reference: m.transaction.reference,
      amount: m.transaction.amount,
      balance: m.transaction.balance,
      matched_document_id: m.matched_document_id,
      match_confidence: m.match_confidence,
      import_batch_id: batchId,
    }))
```

**Step 5: Commit**

```bash
git add src/lib/bank/parsers/ src/app/api/bank/import/route.ts
git commit -m "feat: generic bank parser architecture with Swedbank implementation"
```

---

### Task 11: Bank duplicate detection and balance verification

**Files:**
- Modify: `src/app/api/bank/import/route.ts`

**Step 1: Add duplicate detection and balance verification**

In `src/app/api/bank/import/route.ts`, after parsing transactions and before matching, add duplicate detection:

```typescript
    // Duplicate detection: check existing transactions
    const { data: existingTx } = await supabase
      .from('bank_transactions')
      .select('booking_date, amount, reference')
      .eq('fiscal_year_id', fiscalYear.id)

    const existingSet = new Set(
      existingTx?.map(t => `${t.booking_date}|${t.amount}|${t.reference || ''}`) || []
    )

    const uniqueTransactions = transactions.filter(t => {
      const key = `${t.booking_date}|${t.amount}|${t.reference || ''}`
      return !existingSet.has(key)
    })

    const duplicateCount = transactions.length - uniqueTransactions.length

    if (uniqueTransactions.length === 0) {
      return apiSuccess({
        imported: 0,
        matched: 0,
        unmatched: 0,
        duplicates: duplicateCount,
      })
    }
```

Then use `uniqueTransactions` instead of `transactions` for matching and insert.

Add balance verification after parsing:
```typescript
    // Balance verification
    let balanceWarning: string | null = null
    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1]
      const curr = transactions[i]
      if (prev.balance !== null && curr.balance !== null) {
        const expectedBalance = prev.balance + curr.amount
        if (Math.abs(expectedBalance - curr.balance) > 0.01) {
          balanceWarning = `Saldoavvikelse pa rad ${i + 1}: forvantade ${expectedBalance.toFixed(2)}, fick ${curr.balance.toFixed(2)}`
          break
        }
      }
    }
```

Update the return to include duplicates and balance warning:
```typescript
    return apiSuccess({
      imported: uniqueTransactions.length,
      matched: matchedCount,
      unmatched: uniqueTransactions.length - matchedCount,
      duplicates: duplicateCount,
      balance_warning: balanceWarning,
    })
```

**Step 2: Commit**

```bash
git add src/app/api/bank/import/route.ts
git commit -m "feat: add bank transaction duplicate detection and balance verification"
```

---

### Task 12: Manual matching/unlinking API

**Files:**
- Create: `src/app/api/bank/transactions/[id]/route.ts`

**Step 1: Create PATCH endpoint**

Create `src/app/api/bank/transactions/[id]/route.ts`:
```typescript
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    const update: Record<string, unknown> = {}

    if ('matched_document_id' in body) {
      update.matched_document_id = body.matched_document_id
      update.match_confidence = body.matched_document_id ? 1.0 : null
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .update(update)
      .eq('id', id)
      .select('*, documents(file_name, type, invoice_number, total)')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bank/transactions/\[id\]/route.ts
git commit -m "feat: add manual bank transaction matching/unlinking API"
```

---

### Task 13: Bank reconciliation page — manual matching UI

**Files:**
- Modify: `src/app/(app)/bankavstamning/page.tsx`

**Step 1: Rewrite bank reconciliation page with manual matching**

Replace `src/app/(app)/bankavstamning/page.tsx` with enhanced version that includes:
- "Matcha" button on unmatched rows opening a search modal
- "Avlanka" button on matched rows
- Display of match_confidence as a color-coded badge
- Duplicate and balance warning display after import

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SummaryBoxes from '@/components/SummaryBoxes'
import type { BankTransaction } from '@/types'

type Filter = 'all' | 'matched' | 'unmatched'

interface ImportResult {
  imported: number
  matched: number
  unmatched: number
  duplicates?: number
  balance_warning?: string | null
}

interface SearchDoc {
  id: string
  file_name: string
  type: string
  invoice_number: string | null
  total: number | null
  supplier_name?: string
  customer_name?: string
}

export default function BankavstamningPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchDoc[]>([])

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    const res = await fetch('/api/bank/transactions')
    const json = await res.json()
    const data = json.data ?? json
    if (Array.isArray(data)) setTransactions(data)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/bank/import', { method: 'POST', body: formData })
    const json = await res.json()
    const data = json.data ?? json

    if (res.ok) {
      setImportResult(data)
      fetchTransactions()
    }

    setUploading(false)
  }

  const searchDocuments = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/documents?search=${encodeURIComponent(query)}`)
    const json = await res.json()
    setSearchResults((json.data ?? json).slice(0, 10))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (matchingTxId) searchDocuments(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, matchingTxId, searchDocuments])

  async function handleMatch(txId: string, documentId: string) {
    await fetch(`/api/bank/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matched_document_id: documentId }),
    })
    setMatchingTxId(null)
    setSearchQuery('')
    fetchTransactions()
  }

  async function handleUnlink(txId: string) {
    await fetch(`/api/bank/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matched_document_id: null }),
    })
    fetchTransactions()
  }

  const matched = transactions.filter(t => t.matched_document_id)
  const unmatched = transactions.filter(t => !t.matched_document_id)

  const filtered = filter === 'matched' ? matched
    : filter === 'unmatched' ? unmatched
    : transactions

  function formatDate(date: string | null) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('sv-SE')
  }

  function formatAmount(amount: number) {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency', currency: 'SEK',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount)
  }

  function confidenceBadge(confidence: number | null) {
    if (confidence === null) return null
    const pct = Math.round(confidence * 100)
    const color = confidence >= 0.9 ? 'text-green-400' :
                  confidence >= 0.7 ? 'text-yellow-400' : 'text-red-400'
    return <span className={`text-xs ${color} ml-2`}>{pct}%</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Bankavstamning</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Importera Excel
        </button>
      </div>

      <SummaryBoxes boxes={[
        { label: 'Transaktioner', value: transactions.length, icon: '🏦', format: 'number' },
        { label: 'Matchade', value: matched.length, icon: '✅', format: 'number' },
        { label: 'Saknar kvitto', value: unmatched.length, icon: '❌', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm mb-4">Ladda upp kontoutdrag (Excel-format)</p>
          <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
            {uploading ? 'Importerar...' : 'Valj Excel-fil'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {importResult && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">
                  Importerade {importResult.imported} transaktioner. {importResult.matched} matchade, {importResult.unmatched} omatchade.
                  {importResult.duplicates ? ` ${importResult.duplicates} duplikater ignorerade.` : ''}
                </p>
              </div>
              {importResult.balance_warning && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">{importResult.balance_warning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'matched', 'unmatched'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Alla' : f === 'matched' ? 'Matchade' : 'Omatchade'}
          </button>
        ))}
      </div>

      {/* Manual matching modal */}
      <AnimatePresence>
        {matchingTxId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => { setMatchingTxId(null); setSearchQuery('') }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold mb-4">Matcha med dokument</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sok pa filnamn, fakturanummer, leverantor..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchResults.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleMatch(matchingTxId, doc.id)}
                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="text-white text-sm">{doc.file_name}</div>
                    <div className="text-gray-400 text-xs">
                      {doc.invoice_number && `#${doc.invoice_number} · `}
                      {doc.total && formatAmount(doc.total)}
                      {(doc.supplier_name || doc.customer_name) && ` · ${doc.supplier_name || doc.customer_name}`}
                    </div>
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">Inga dokument hittades</p>
                )}
              </div>
              <button
                onClick={() => { setMatchingTxId(null); setSearchQuery('') }}
                className="mt-4 text-sm text-gray-400 hover:text-white"
              >
                Avbryt
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Typ</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Referens</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Belopp</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Saldo</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Matchat dokument</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, i) => (
              <motion.tr
                key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`border-b border-gray-800/50 transition-colors ${
                  tx.matched_document_id
                    ? 'hover:bg-green-500/5'
                    : 'hover:bg-red-500/5'
                }`}
              >
                <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(tx.booking_date)}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{tx.transaction_type || '-'}</td>
                <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-xs">{tx.reference || '-'}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${tx.amount >= 0 ? 'text-green-400' : 'text-white'}`}>
                  {formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm text-right font-mono">
                  {tx.balance != null ? formatAmount(tx.balance) : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {tx.documents ? (
                    <span className="text-green-400">
                      {tx.documents.file_name}
                      {confidenceBadge(tx.match_confidence)}
                    </span>
                  ) : (
                    <span className="text-red-400/60">Inget kvitto</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {tx.matched_document_id ? (
                    <button
                      onClick={() => handleUnlink(tx.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Avlanka
                    </button>
                  ) : (
                    <button
                      onClick={() => setMatchingTxId(tx.id)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Matcha
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {transactions.length === 0 ? 'Inga transaktioner importerade' : 'Inga transaktioner matchar filtret'}
          </p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/bankavstamning/page.tsx
git commit -m "feat: add manual matching UI with confidence badges and import feedback"
```

---

### Task 14: Fulltext search — API

**Files:**
- Modify: `src/app/api/documents/route.ts`

**Step 1: Add search parameter to documents API**

In `src/app/api/documents/route.ts`, add after line 17 (the existing searchParams):
```typescript
    const search = searchParams.get('search')
```

After the existing filter blocks (after line 62), add search logic:
```typescript
    if (search) {
      const term = `%${search}%`
      query = query.or(
        `file_name.ilike.${term},invoice_number.ilike.${term},suppliers.name.ilike.${term},customers.name.ilike.${term}`
      )
    }
```

**Step 2: Commit**

```bash
git add src/app/api/documents/route.ts
git commit -m "feat: add fulltext search to documents API"
```

---

### Task 15: Fulltext search — UI component

**Files:**
- Create: `src/components/SearchInput.tsx`

**Step 1: Create reusable search input**

Create `src/components/SearchInput.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'

interface SearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export default function SearchInput({ onSearch, placeholder = 'Sok...' }: SearchInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), 300)
    return () => clearTimeout(timer)
  }, [value, onSearch])

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none w-64"
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SearchInput.tsx
git commit -m "feat: add reusable SearchInput component with debounce"
```

---

### Task 16: Integrate search into document pages

**Files:**
- Look at which pages list documents (kundfakturor, leverantorsfakturor, ovriga-dokument) and add SearchInput

**Step 1: Find document list pages**

Check which pages exist under `src/app/(app)/` that list documents. These typically fetch from `/api/documents?type=...`. Add `SearchInput` to each and pass the search query to the fetch URL.

For each page that fetches documents, add:
```typescript
import SearchInput from '@/components/SearchInput'
```

And in the JSX header area, add the search input:
```typescript
<SearchInput
  onSearch={(q) => setSearchQuery(q)}
  placeholder="Sok dokument..."
/>
```

And in the fetch function, append search:
```typescript
const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
const res = await fetch(`/api/documents?type=outgoing${searchParam}`)
```

Add state: `const [searchQuery, setSearchQuery] = useState('')`
Add useEffect dependency on searchQuery to re-fetch.

This needs to be done for each document listing page. The exact files depend on what exists — apply the same pattern to each.

**Step 2: Commit**

```bash
git add src/app/\(app\)/kundfakturor/ src/app/\(app\)/leverantorsfakturor/ src/app/\(app\)/ovriga-dokument/
git commit -m "feat: add search functionality to document list pages"
```

---

### Task 17: Clean up old parse-swedbank.ts + update imports

**Files:**
- Delete: `src/lib/bank/parse-swedbank.ts` (replaced by parsers/swedbank.ts)
- Verify: No other files import from the old location

**Step 1: Check for remaining imports of old file**

Search for `parse-swedbank` in all files. Update any remaining imports to use `@/lib/bank/parsers`.

**Step 2: Delete old file and commit**

```bash
git rm src/lib/bank/parse-swedbank.ts
git add -A
git commit -m "refactor: remove old parse-swedbank.ts, replaced by parsers architecture"
```

---

### Task 18: Update TODO.md

**Files:**
- Modify: `TODO.md`

**Step 1: Mark completed items in TODO.md**

Mark these items as done:
- [x] Gora AI-prompten dynamisk
- [x] Inkludera senaste ai_corrections automatiskt i extraktions-prompten
- [x] Validera att AI-extraherade belopp ar rimliga
- [x] Lagg till loggning av alla AI-interaktioner for debugging
- [x] Hantera AI-fel battre - koa for retry
- [x] Forbattra matchningsalgoritm - lagg till konfidenspoang
- [x] Lagg till stod for fler banker
- [x] Lagg till manuell matchning/avlankning av transaktioner
- [x] Lagg till duplikatdetektering for transaktioner
- [x] Lagg till saldoverifering
- [x] Sokfunktion - fulltext-sokning over dokument
- [x] Automatisk kategorisering baserat pa leverantor

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark completed AI, bank, and feature TODO items"
```

---

## Summary

**18 tasks** organized in dependency order:
1. DB migrations (foundation)
2. Types (foundation)
3. Dynamic prompt (AI)
4. Amount validation (AI)
5. AI logging + retry (AI)
6. Upload route updates (AI integration)
7. Settings API (AI)
8. Settings page UI (AI)
9. Bank matching with confidence (Bank)
10. Generic parser architecture (Bank)
11. Duplicate detection + balance verification (Bank)
12. Manual matching API (Bank)
13. Manual matching UI (Bank)
14. Fulltext search API (Features)
15. Search component (Features)
16. Search integration in pages (Features)
17. Cleanup old files (Cleanup)
18. Update TODO (Docs)

Tasks 1-2 are prerequisites. Tasks 3-8 (AI) are independent from 9-13 (Bank) and 14-16 (Features). Within each group, tasks are sequential.
