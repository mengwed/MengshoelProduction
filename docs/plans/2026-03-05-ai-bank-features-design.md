# Design: AI-forbattringar, Bankavstamning & Nya funktioner

## 1. AI-forbattringar

### 1.1 Dynamisk prompt via company_settings

Ny tabell `company_settings` med: company_name, organization_type, owner_name, industry, notes.

Ny sida `/installningar` med form for att redigera foretaginformation. API: `GET/PUT /api/settings`.

`prompt.ts` andras fran statisk strang till `buildPrompt(settings: CompanySettings)` — alla "Mengshoel Production"-hardkodningar ersatts med dynamiska variabler.

### 1.2 AI corrections i prompten

Redan delvis implementerat (20 senaste corrections laddas i upload/route.ts). Forbattring: formatera dem tydligt i system-prompten som en dedikerad "lar dig av dessa korrigeringar"-sektion.

### 1.3 Beloppsvalidering

Efter AI-extraktion, validera:
- Inget belopp > 100 000 000 SEK
- Inga negativa belopp pa fakturor
- total ~= amount + vat (tolerans 1 SEK)

Flaggar `ai_needs_review: true` om validering misslyckas.

### 1.4 AI-loggning

Ny tabell `ai_logs` med: document_id, model, prompt_tokens, completion_tokens, duration_ms, raw_response (JSONB), error, created_at.

Loggar varje Claude-anrop i extract.ts — bade lyckade och misslyckade.

### 1.5 Retry vid AI-fel

- Retry upp till 2 ganger med exponential backoff (1s, 3s)
- Om alla retry misslyckas: skapa dokument med status 'imported', ai_needs_review: true, tomt ai_extracted_data, tydligt felmeddelande

## 2. Bankavstamning

### 2.1 Konfidenspoang

Matchningsmetoder returnerar confidence-poang:
- Exakt referensnummer-match: 0.95
- Referens innehaller fakturanummer: 0.80
- Belopp + datum inom 7 dagar: 0.75
- Belopp + datum inom 30 dagar: 0.60
- Leverantorsnamn i referens + belopp: 0.70
- Leverantorsnamn i referens (utan belopp): 0.40

Automatisk matchning vid confidence >= 0.70. Under det visas som "foreslagen" i UI.

DB-andring: `match_confidence DECIMAL(3,2)` pa bank_transactions.

### 2.2 Generisk bankparser-arkitektur

```
src/lib/bank/
  parsers/
    swedbank.ts      (befintlig, flyttas hit)
    seb.ts           (framtida)
    index.ts         (registry + auto-detect)
  types.ts           (gemensamt BankTransaction-interface)
  match.ts           (befintlig)
```

Parser-interface:
```typescript
interface BankParser {
  name: string;
  detect(workbook: XLSX.WorkBook): boolean;
  parse(workbook: XLSX.WorkBook): BankTransaction[];
}
```

Auto-detect: iterera registrerade parsers, kor detect(), anvand ratt parser. Okant format -> tydligt felmeddelande.

### 2.3 Manuell matchning/avlankning

UI pa /bankavstamning:
- Omatchade: "Matcha"-knapp -> modal med sokbar dokumentlista
- Matchade: "Avlanka"-knapp -> satter matched_document_id = null

API: `PATCH /api/bank/transactions/[id]` for att uppdatera matchning.

### 2.4 Duplikatdetektering

Vid import: kolla om transaktion med samma booking_date + amount + reference redan finns. Skippa duplikater, rapportera antal i svaret.

### 2.5 Saldoverifiering

Efter import: verifiera att saldo-kolumnen ar konsekvent (varje rad = foregaende saldo + belopp). Inkonsistens -> varning i UI (inte blockerande).

## 3. Nya funktioner

### 3.1 Fulltext-sokning

API: ny `search`-parameter pa `GET /api/documents`. Soker med ILIKE pa file_name, invoice_number, supplier/customer-namn (via JOIN), och ai_extracted_data::text.

UI: sokfalt hogst upp pa dokumentsidor med 300ms debounce.

### 3.2 Auto-kategorisering (forbattring)

Redan delvis implementerat. Tillagg:
- Vid AI-extraktion: om matchad leverantor har kategori -> satt kategorin och hoj ai_confidence med 5
- Visa pa leverantorssidan vilken default-kategori varje leverantor har, med mojlighet att andra
