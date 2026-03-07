# AI-driven bankavstamning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken parser and basic rule-matching with a hybrid approach (improved rules + Claude AI) and a new approval-based UX for bank reconciliation.

**Architecture:** Fix Swedbank parser to handle Swedish characters. Add new DB columns for AI suggestions and match status. Enhance rule-based matching, then add Claude AI batch matching for remaining unmatched transactions. Rebuild the UI with approval workflow and export.

**Tech Stack:** Next.js App Router, Supabase, Anthropic Claude SDK, xlsx, Tailwind CSS, Framer Motion, Vitest

---

### Task 1: Fix Swedbank parser detection and parsing

**Files:**
- Modify: `src/lib/bank/parsers/swedbank.ts`
- Test: `src/lib/bank/parse-swedbank.test.ts`

**Step 1: Update the existing test file to cover Swedish characters**

In `src/lib/bank/parse-swedbank.test.ts`, add/update tests that use actual Swedish column headers (`Bokföringsdatum`, `Radnummer`, `Bokfört saldo`, `Valutadatum`).

Create a test workbook with the real 8-column Swedbank format:
```
Row 0: ["Transaktioner Foretagskonto"]
Row 7: ["Radnummer","Bokföringsdatum","Transaktionsdatum","Valutadatum","Transaktionstyp","Referens","Belopp","Bokfört saldo"]
Row 8: ["1","2025-12-30","2025-12-30","2026-01-02","Bankgiro inbetalning","57744724",62500,89623.28]
Row 9: ["2","2025-12-19","2025-12-19","2025-12-19","Bankgiro","BET 44556",",-3500",86123.28]
```

Test that:
- `detect()` returns true for headers with Swedish characters (ö, ö)
- `parse()` correctly skips the `Radnummer` and `Valutadatum` columns
- `parse()` returns correct booking_date, transaction_date, transaction_type, reference, amount, balance
- `parse()` handles multiple rows

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bank/parse-swedbank.test.ts`
Expected: FAIL — detect returns false, parse returns wrong fields

**Step 3: Fix the parser**

In `src/lib/bank/parsers/swedbank.ts`:

1. Update `detect()` to also match `Bokföringsdatum` (with ö) and `Radnummer`:
```typescript
(cell.includes('Bokföringsdatum') || cell.includes('Bokforingsdatum') || cell.includes('Bokforingsdag') || cell.includes('Radnummer'))
```

2. Update `parse()` similarly for header detection.

3. Fix the column index mapping for the 8-column format. When `Radnummer` header is detected:
   - col 0: Radnummer (skip)
   - col 1: Bokföringsdatum → booking_date
   - col 2: Transaktionsdatum → transaction_date
   - col 3: Valutadatum (skip)
   - col 4: Transaktionstyp → transaction_type
   - col 5: Referens → reference
   - col 6: Belopp → amount
   - col 7: Bokfört saldo → balance

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bank/parse-swedbank.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/bank/parsers/swedbank.ts src/lib/bank/parse-swedbank.test.ts
git commit -m "fix: swedbank parser handles Swedish characters and 8-column format"
```

---

### Task 2: Database migration — add AI suggestion columns

**Files:**
- Create: `supabase/migrations/008_bank_ai_matching.sql`
- Modify: `supabase/schema.sql:104-116` (update reference schema)
- Modify: `src/types/index.ts:98-118` (update BankTransaction type)

**Step 1: Write the migration**

```sql
-- Add AI matching columns to bank_transactions
ALTER TABLE bank_transactions
  ADD COLUMN ai_suggestion_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN ai_confidence DECIMAL(3,2),
  ADD COLUMN ai_explanation TEXT,
  ADD COLUMN match_status TEXT CHECK (match_status IN ('pending', 'approved', 'rejected', 'manual'));

-- Index for filtering by match status
CREATE INDEX idx_bank_transactions_match_status ON bank_transactions(match_status);
```

**Step 2: Update the reference schema**

Add the new columns to the `bank_transactions` table definition in `supabase/schema.sql`.

**Step 3: Update the TypeScript type**

In `src/types/index.ts`, add to `BankTransaction`:
```typescript
ai_suggestion_id: string | null
ai_confidence: number | null
ai_explanation: string | null
match_status: 'pending' | 'approved' | 'rejected' | 'manual' | null
```

**Step 4: Apply migration locally**

Run the migration against the local Supabase instance. Provide the user with instructions:
```
Go to Supabase dashboard → SQL Editor → paste and run the migration SQL.
```

**Step 5: Commit**

```bash
git add supabase/migrations/008_bank_ai_matching.sql supabase/schema.sql src/types/index.ts
git commit -m "feat: add AI matching columns to bank_transactions"
```

---

### Task 3: Improve rule-based matching (belopp+moms, fuzzy name)

**Files:**
- Modify: `src/lib/bank/match.ts`
- Test: `src/lib/bank/__tests__/match.test.ts`

**Step 1: Add new test cases**

Add tests for:
- Amount + VAT match: tx amount = 62500, doc amount = 50000, doc vat = 12500, doc total = 62500 → should score high
- Amount matches doc.total (not just doc.amount): tx = -1500, doc.total = 1500 → should match
- Fuzzy name: reference contains partial supplier name (>= 4 chars)

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bank/__tests__/match.test.ts`

**Step 3: Update scoreMatch**

In `src/lib/bank/match.ts`, update `scoreMatch`:

1. When comparing amounts, also check `Math.abs(txAmount - Math.abs(doc.total ?? 0)) < 0.01` (currently only checks `doc.total ?? doc.amount`)
2. Add amount+VAT logic: check if `txAmount === Math.abs((doc.amount ?? 0) + (doc.vat ?? 0))`
3. Improve fuzzy name matching: use minimum 4 chars instead of 8, and normalize strings (lowercase, trim)

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bank/__tests__/match.test.ts`

**Step 5: Commit**

```bash
git add src/lib/bank/match.ts src/lib/bank/__tests__/match.test.ts
git commit -m "feat: improve rule-based matching with VAT and fuzzy name support"
```

---

### Task 4: Claude AI batch matching

**Files:**
- Create: `src/lib/bank/ai-match.ts`
- Create: `src/lib/bank/__tests__/ai-match.test.ts`

**Step 1: Write tests for the prompt builder and response parser**

Test `buildMatchPrompt()`:
- Takes array of unmatched transactions + array of documents
- Returns a well-formed prompt string

Test `parseMatchResponse()`:
- Takes Claude's JSON response
- Returns array of `{ transactionIndex, documentId, confidence, explanation }`
- Handles "no match" entries with explanation

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bank/__tests__/ai-match.test.ts`

**Step 3: Implement AI matching module**

Create `src/lib/bank/ai-match.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

interface UnmatchedTransaction {
  index: number
  booking_date: string
  transaction_type: string | null
  reference: string | null
  amount: number
}

interface DocumentSummary {
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
  // Build a prompt that asks Claude to match transactions to documents
  // Include all transaction data and document summaries
  // Ask for JSON response with matches
}

export function parseMatchResponse(
  responseText: string,
  transactions: UnmatchedTransaction[]
): AIMatchSuggestion[] {
  // Parse Claude's JSON response into typed suggestions
}

export async function aiMatchTransactions(
  transactions: UnmatchedTransaction[],
  documents: DocumentSummary[]
): Promise<{ suggestions: AIMatchSuggestion[]; error?: string }> {
  // 1. Build prompt
  // 2. Call Claude API (claude-haiku-4-5-20251001)
  // 3. Parse response
  // 4. Log to ai_logs
  // 5. Return suggestions
  // 6. On error: return { suggestions: [], error: message }
}
```

The prompt should instruct Claude to:
- Match each transaction to the best document based on amount, date, reference, supplier/customer name
- Return confidence 0-1 and a short Swedish explanation
- For unmatched transactions, explain why no match was found
- Return valid JSON array

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bank/__tests__/ai-match.test.ts`

**Step 5: Commit**

```bash
git add src/lib/bank/ai-match.ts src/lib/bank/__tests__/ai-match.test.ts
git commit -m "feat: add Claude AI batch matching for bank transactions"
```

---

### Task 5: Update import API route with AI matching + new columns

**Files:**
- Modify: `src/app/api/bank/import/route.ts`

**Step 1: Update the import route**

Modify `POST` in `src/app/api/bank/import/route.ts`:

1. After rule-based matching, collect unmatched transactions
2. Load all unmatched documents for the fiscal year
3. Call `aiMatchTransactions()` with unmatched transactions + documents
4. For rule-matched rows: set `match_status = 'pending'`, copy existing `matched_document_id` and `match_confidence`
5. For AI-matched rows: set `ai_suggestion_id`, `ai_confidence`, `ai_explanation`, `match_status = 'pending'`, leave `matched_document_id` null (until approved)
6. For unmatched rows: set `ai_explanation` (Claude's reason), `match_status = null`
7. Wrap Claude call in try/catch — if it fails, set `ai_explanation = null` and return an `ai_error` field in the response
8. Return updated result shape: `{ imported, rule_matched, ai_matched, unmatched, duplicates, balance_warning, ai_error? }`

**Step 2: Commit**

```bash
git add src/app/api/bank/import/route.ts
git commit -m "feat: integrate AI matching into bank import flow"
```

---

### Task 6: Update PATCH route for approve/reject/manual match

**Files:**
- Modify: `src/app/api/bank/transactions/[id]/route.ts`

**Step 1: Update the PATCH handler**

Support these actions:
- **Approve**: `{ action: 'approve' }` → copy `ai_suggestion_id` to `matched_document_id`, set `match_status = 'approved'`, `match_confidence = ai_confidence`
- **Reject**: `{ action: 'reject' }` → set `match_status = 'rejected'`, clear `matched_document_id`
- **Manual match**: `{ action: 'manual', document_id: '...' }` → set `matched_document_id`, `match_status = 'manual'`, `match_confidence = 1.0`
- **Unlink**: `{ action: 'unlink' }` → clear `matched_document_id`, set `match_status = null`
- Keep backward compatibility with existing `{ matched_document_id }` body format

**Step 2: Commit**

```bash
git add src/app/api/bank/transactions/[id]/route.ts
git commit -m "feat: add approve/reject/manual actions for bank matching"
```

---

### Task 7: Update GET route to include AI suggestion data

**Files:**
- Modify: `src/app/api/bank/transactions/route.ts`

**Step 1: Update the select query**

Add `ai_suggestion_id`, `ai_confidence`, `ai_explanation`, `match_status` to the select.

Also join the suggested document: add a second join for the AI suggestion document info. Since Supabase doesn't support aliased joins easily, we can do a separate query or embed the info. Simplest approach: select `ai_suggestion:documents!ai_suggestion_id(file_name, type, invoice_number, total)` if supported, or return `ai_suggestion_id` and let the frontend handle it.

**Step 2: Update BankTransaction type if needed**

Add `ai_suggestion` joined field to the type:
```typescript
ai_suggestion?: {
  file_name: string
  type: string
  invoice_number: string | null
  total: number | null
} | null
```

**Step 3: Commit**

```bash
git add src/app/api/bank/transactions/route.ts src/types/index.ts
git commit -m "feat: include AI suggestion data in transactions API response"
```

---

### Task 8: Add bank reconciliation export API

**Files:**
- Create: `src/app/api/bank/export/route.ts`

**Step 1: Create the export route**

Model after `src/app/api/documents/export/route.ts`. Create a GET endpoint that:

1. Loads all bank transactions for the active fiscal year with joined document data
2. Maps to Excel rows:
   - Datum (booking_date)
   - Typ (transaction_type)
   - Referens (reference)
   - Belopp (amount)
   - Saldo (balance)
   - Status (match_status: Godkand/Avslagen/Manuell/Vantande/Ej matchad)
   - Matchat dokument (document file_name or "Ej matchad")
   - AI-forklaring (ai_explanation)
3. Return xlsx file with filename `Bankavstamning_YYYY.xlsx`

**Step 2: Commit**

```bash
git add src/app/api/bank/export/route.ts
git commit -m "feat: add bank reconciliation Excel export"
```

---

### Task 9: Rebuild bankavstamning page UI

**Files:**
- Modify: `src/app/(app)/bankavstamning/page.tsx`

**Step 1: Rebuild the page**

This is the largest task. The page needs:

**Import section:**
- Same file upload button
- Progress indicator during import ("Importerar... Kor AI-matchning...")
- Result summary showing rule_matched, ai_matched, unmatched counts
- If `ai_error`: warning banner with "AI-matchning kunde inte koras: [error]. Regelbaserade forslag visas." + "Forsok igen" button

**Filter tabs:**
- Alla / Att granska (pending) / Godkanda (approved) / Omatchade (no match)

**Transaction list (table on desktop, cards on mobile):**
Each row shows:
- Transaction data: date, type, reference, amount, balance
- Match suggestion section:
  - If rule-matched or AI-matched (pending): show suggested document name, confidence badge (green >= 0.9, yellow >= 0.7, red < 0.7), AI explanation text
  - Buttons: "Godkann" (approve) + "Byt dokument" (opens search modal)
  - If approved: green checkmark + document name + "Avlanka" button
  - If manual: document name + "Avlanka" button
  - If unmatched: red text "Ej matchad" + AI explanation + "Matcha" button (opens search modal)

**Search modal (existing, keep as-is):**
- Used for "Byt dokument" and "Matcha" actions
- On select: calls PATCH with `action: 'manual'`

**Export button:**
- Add "Exportera Excel" button next to "Importera Excel"
- Calls `/api/bank/export` and downloads the file

**AI retry:**
- Add a new API endpoint or query param: `POST /api/bank/ai-retry?batch_id=xxx`
- Or simpler: a button that calls a new endpoint to re-run AI matching on unmatched transactions in the current batch

**Step 2: Commit**

```bash
git add src/app/(app)/bankavstamning/page.tsx
git commit -m "feat: rebuild bank reconciliation UI with AI matching and approval workflow"
```

---

### Task 10: Add AI retry endpoint

**Files:**
- Create: `src/app/api/bank/ai-retry/route.ts`

**Step 1: Create the retry endpoint**

`POST /api/bank/ai-retry`:
1. Load all unmatched transactions (where `matched_document_id IS NULL AND (match_status IS NULL OR match_status = 'rejected')`) for active fiscal year
2. Load all unmatched documents
3. Call `aiMatchTransactions()`
4. Update the transactions with new AI suggestions
5. Return updated counts
6. On error: return `{ error: message }`

**Step 2: Commit**

```bash
git add src/app/api/bank/ai-retry/route.ts
git commit -m "feat: add AI retry endpoint for bank matching"
```

---

### Task 11: End-to-end testing and polish

**Step 1: Manual testing checklist**

1. Delete existing bank transactions (clear test data)
2. Import the real Excel file — verify all rows are parsed
3. Check that rule-based matches appear with pending status
4. Check that AI suggestions appear for remaining transactions
5. Approve a match — verify it becomes green/approved
6. Reject a match — verify it goes back to unmatched
7. Manually match a transaction — verify it works
8. Export to Excel — verify the file downloads with correct data
9. Test AI error handling: temporarily break the API key, import again, verify fallback message
10. Test mobile layout

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: polish bank reconciliation after testing"
```
