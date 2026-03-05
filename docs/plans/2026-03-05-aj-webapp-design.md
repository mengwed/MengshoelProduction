# AJ — Webbapp for bokforing

## Oversikt

AJ ar en webbapp for bokforing, baserad pa den befintliga Electron-appen "AJ Bokforing". Webbappen ersatter desktop-appen med forbattrad AI-baserad PDF-hantering, smartare momshantering och ett modernt, snyggt granssnitt.

**Anvandare:** 2 personer med inloggning, delad data
**Malgrupp:** Person som HATAR ekonomi — appen ska gora det uthardligt, kanske till och med lite kul

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Next.js API routes (server-side)
- **Databas:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Fillagring:** Supabase Storage
- **AI:** Claude Haiku API (PDF-extraktion)
- **Deploy:** Vercel, direkt fran GitHub (push = live)

## Kostnad

- Supabase: gratis (free tier racker)
- Vercel: gratis (free tier racker)
- Claude API: ~15-35 kr/man (25 dokument/man)
- **Total: ~15-35 kr/man**

## Datamodell

### documents

Huvudtabell for alla typer av dokument.

| Falt | Typ | Beskrivning |
|------|-----|-------------|
| id | uuid | Primar nyckel |
| type | enum | 'outgoing_invoice', 'incoming_invoice', 'payment_received', 'credit_card_statement', 'government_fee', 'loan_statement', 'receipt', 'other' |
| fiscal_year_id | int | FK till fiscal_years |
| customer_id | int, nullable | FK till customers |
| supplier_id | int, nullable | FK till suppliers |
| linked_document_id | uuid, nullable | Koppling, t.ex. inbetalning till kundfaktura |
| invoice_number | text, nullable | Fakturanummer |
| invoice_date | date, nullable | Fakturadatum |
| due_date | date, nullable | Forfallodatum |
| amount | decimal, nullable | Belopp exkl moms |
| vat | decimal, nullable | Momsbelopp |
| vat_rate | decimal, nullable | Momssats (25, 12, 6, 0) |
| total | decimal, nullable | Belopp inkl moms |
| payment_date | date, nullable | Betalningsdatum |
| category_id | int, nullable | FK till categories |
| file_path | text | Sokvag i Supabase Storage |
| file_name | text | Ursprungligt filnamn |
| ai_extracted_data | jsonb | Ra AI-output for sparbarhet |
| ai_confidence | int | 0-100, hur saker AI:n var |
| ai_needs_review | boolean | Flagga for manuell granskning |
| status | enum | 'imported', 'reviewed', 'paid' |
| created_at | timestamp | Skapad |

### document_lines

For dokument med flera transaktioner (t.ex. kreditkortskontoutdrag).

| Falt | Typ | Beskrivning |
|------|-----|-------------|
| id | uuid | Primar nyckel |
| document_id | uuid | FK till documents |
| date | date | Transaktionsdatum |
| description | text | Beskrivning (t.ex. "AUTOMATBOLAGET") |
| amount | decimal | Belopp |
| category_id | int, nullable | FK till categories |
| created_at | timestamp | Skapad |

### bank_transactions

Importerade banktransaktioner for bankavstamning.

| Falt | Typ | Beskrivning |
|------|-----|-------------|
| id | uuid | Primar nyckel |
| fiscal_year_id | int | FK till fiscal_years |
| booking_date | date | Bokforingsdatum |
| transaction_date | date | Transaktionsdatum |
| transaction_type | text | T.ex. "Kortköp/uttag", "Bankgiro inbetalning" |
| reference | text | Referenstext fran banken |
| amount | decimal | Belopp |
| balance | decimal | Bokfort saldo |
| matched_document_id | uuid, nullable | FK till documents om matchad |
| import_batch_id | uuid | Vilken import den tillhor |
| created_at | timestamp | Skapad |

### Ovriga tabeller (fran originalet)

- **fiscal_years** — rakenskapsarshantering (id, year, is_active)
- **customers** — kundregister (id, name, org_number, address, etc.)
- **suppliers** — leverantorsregister (id, name, org_number, address, category_id, etc.)
- **categories** — kategorier med emoji (id, name, description, emoji)

## AI-extraktion

### Klassificering

AI:n klassificerar varje PDF baserat pa innehall:

| Ledtrad | Dokumenttyp |
|---------|-------------|
| "Mengshoel Production" som avsandare | outgoing_invoice |
| "Mengshoel Production" som mottagare | incoming_invoice |
| "Inbetalningsdetaljer" + bankuppgifter | payment_received |
| "ACCOUNT STATEMENT" / kontoutdrag | credit_card_statement |
| Transportstyrelsen/Skatteverket | government_fee |
| "Laneavisering" | loan_statement |

### Extraktion per typ

- **Fakturor:** fakturanr, datum, forfallodatum, belopp exkl moms, moms, momssats, total, kund/leverantorsnamn, orgnr
- **Inbetalningar:** datum, belopp, betalningsreferens, avsandarnamn (matcha mot kund), referensnr (matcha mot fakturanr)
- **Kontoutdrag:** varje rad som separat document_line med datum, beskrivning, belopp
- **Myndighetsavgifter:** belopp, datum, typ av avgift, moms = 0
- **Laneaviseringar:** rantebelopp, period, rantesats, moms = 0

### Regler

- Om avsandaren ar "Mengshoel Production" = ALLTID utgaende kundfaktura
- Om moms inte tydligt framgar: satt vat = null och flagga, gissa ALDRIG
- Myndigheter och banker har aldrig moms
- Kontoutdrag ska alltid splittras till rader

### Matchning

- Kund/leverantor: fuzzy match mot befintliga i databasen
- Inbetalning: matcha referensnr mot fakturanr
- Kontoutdrag: foreslå kategori per rad baserat pa historik

### Confidence

- Hog (80-100): sparas direkt
- Medium (50-79): sparas men flaggas med varning
- Lag (<50): sparas som "needs review"

### Kostnad

Claude Haiku: ~0.5-1.5 kr/dokument. Vid 25 dokument/man = ~15-35 kr/man.

## Granssnitt

### Designsprak

- Morkt tema som default (narmast svart bakgrund, ljus text) — Spotify/Linear-vibbar
- Accentfarger: varm gradient (rosa till lila eller orange till gul)
- Stora, runda kort med subtila skuggor och glasmorfism
- Framer Motion-animationer: kort glider in, siffror raknar upp, smooth transitions
- Emoji som visuella markorer
- Typsnitt: Inter eller liknande modernt sans-serif
- Responsiv men optimerad for desktop
- Snygg AJ-ikon och favicon (SVG)

### Navigation (sidebar)

1. Dashboard
2. Kundfakturor
3. Leverantorsfakturor
4. Bankavstamning
5. Kunder & Leverantorer
6. Kategorier

### Dashboard

Summerings-boxar overst:

| Box | Innehall |
|-----|----------|
| Intakter | Totalt fran kundfakturor (exkl moms) |
| Utgaende moms | Total moms pa kundfakturor |
| Kostnader | Totalt fran leverantorsfakturor |
| Ingaende moms | Total moms pa leverantorsfakturor |
| Resultat | Intakter - Kostnader |
| Moms att betala | Utgaende moms - Ingaende moms |

Plus: graf (manadsversikt), jamforelse med foregaende ar/manad, "Att granska"-sektion.

### Kundfakturor

- Lista med alla utgaende fakturor
- Summerings-boxar: totalt fakturerat, total moms, antal fakturor, varav betalda
- Inbetalningar kopplade till respektive faktura (betald/vantar)
- Snabbfilter: manad, status, "behover granskas"
- Excel-export

### Leverantorsfakturor

- Lista med alla inkommande dokument
- Summerings-boxar: totala kostnader, total ingaende moms, antal dokument
- Kategorisering med emoji-taggar
- Snabbfilter: manad, status, kategori, "behover granskas"
- Excel-export

### Bankavstamning

1. Ladda upp transaktionsfil (.xlsx fran Swedbank)
2. Appen parsar automatiskt (Bokforingsdatum, Referens, Belopp, Transaktionstyp)
3. Automatisk matchning mot dokument: belopp + datum, referenstext, leverantorsnamn
4. Visar tre kategorier:
   - Matchade (transaktion + dokument)
   - Omatchade / saknar kvitto (banktransaktion utan dokument)
   - Saknas i banken (dokument utan banktransaktion)

### Dokumentvy (slide-over panel)

Klicka pa ett dokument i nagon lista:
- PDF-forhandsgranskning
- AI-extraherad data (redigerbar)
- "Byt typ"-knapp (flytta mellan kund/leverantor med ett klick)
- Koppla till kund/leverantor
- Koppla inbetalning till faktura

### Uppladdning

- Drag-and-drop eller filväljare pa Kundfakturor/Leverantorsfakturor-sidorna
- Sidan man laddar upp fran ger AI:n en ledtrad om typ
- Batch-uppladdning (10+ filer pa en gang)
- Progress per fil: Analyserar -> Klar / Behover granskas
- Dubblettvarning: "Den har liknar [dokument X], vill du spara anda?"
- Efter batch: snabb oversikt med mojlighet att korrigera innan sparning

## Existerande data fran originalet

Fran AJ Bokforing (Electron-appen):
- Kontoplan (BAS-konton) — ej relevant for webbappen i v1
- Kunder: SVT, UR
- Leverantorer: Fortnox, Hallon, Parkster, InExchange, Ziklo/Volvo, m.fl.
- Faktura-mappstruktur: manadsmappar (01 Januari, 02 Februari, etc.)
- Filnamnskonvention: "YY-MM-DD beskrivning belopp.pdf"

## Avgransningar (ej i version 1)

- iCloud-synk (manuell uppladdning racker)
- Kontoplan / BAS-konton
- Bokforingsverifikationer / huvudbok
- Fler an 2 anvandare
- Multipla foretag
