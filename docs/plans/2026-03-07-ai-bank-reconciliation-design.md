# AI-driven bankavstamning — Design

## Problem

Anne laddar ner transaktionslistan fran Swedbank (Excel) och behover matcha varje transaktion mot ratt faktura, kvitto eller dokument i appen. Idag ar detta manuellt arbete. Den befintliga regelbaserade matchningen missar mycket och parsern har buggar (hanterar inte svenska tecken i kolumnnamn).

## Losning

En hybrid matchningsstrategi (regler + Claude AI) med ett tydligt godkannandeflode dar Anne behaller kontrollen.

## 1. Parsning (buggfix)

- Swedbank-parserns `detect()` och `parse()` uppdateras for att hantera svenska tecken (`Bokforingsdatum` -> `Bokföringsdatum`)
- Korrekt hantering av 8-kolumners format: Radnummer, Bokforingsdatum, Transaktionsdatum, Valutadatum, Transaktionstyp, Referens, Belopp, Bokfort saldo

## 2. Matchningsstrategi

### Steg 1 — Forbattrad regelbaserad matchning
- Matcha belopp exakt (inkl. belopp + moms = total)
- Matcha referens/OCR mot fakturanummer
- Fuzzy leverantors-/kundnamn mot referensfaltet
- Datumproximitet som tiebreaker

### Steg 2 — Claude AI for resten
- Skicka alla omatchade transaktioner + alla omatchade dokument till Claude i ett batch-anrop
- Claude far kontext: transaktionsdata + dokumentlista (typ, belopp, datum, leverantor/kund, fakturanummer)
- Claude returnerar matchningsforslag med confidence + kort forklaring
- For transaktioner utan match ger Claude en forklaring ("Troligtvis ett kvitto som inte laddats upp annu")

### Felhantering
- Om Claude-API:n inte fungerar (ogiltig nyckel, natverksfel, etc.):
  - Regelbaserade matchningar fungerar fortfarande och sparas
  - Tydligt felmeddelande: "AI-matchning kunde inte koras: [anledning]. Regelbaserade forslag visas."
  - Knapp: "Forsok AI-matchning igen"

## 3. Datamodell

Befintlig `bank_transactions`-tabell utokas med:
- `ai_suggestion_id` (uuid, nullable) — AI:ns foreslagna dokument (innan godkannande)
- `ai_confidence` (float, nullable) — AI:ns confidence-poang
- `ai_explanation` (text, nullable) — kort forklaring
- `match_status` (text, nullable) — `'pending' | 'approved' | 'rejected' | 'manual'`

### Flode
- Vid import: bade regelbaserade och AI-matchningar far `match_status = 'pending'`
- Anne godkanner -> `match_status = 'approved'`, `matched_document_id` satts
- Anne byter dokument -> `match_status = 'manual'`, nytt dokument lankas
- Omatchade har `match_status = null`

## 4. Importflode & UX

1. Anne klickar "Importera Excel" och valjer fil
2. **Laddningsvy** — "Importerar 251 transaktioner... Kor AI-matchning..." (progress)
3. **Resultatvy** — alla transaktioner visas rad for rad:
   - Transaktionsdata (datum, typ, referens, belopp)
   - AI-forslag: matchat dokument med confidence-badge (gron/gul) + kort AI-forklaring
   - Knappar: "Godkann" eller "Byt dokument" per rad
   - Omatchade rader visas med rod markering + AI:ns forklaring
4. Anne gar igenom listan, godkanner de som stammer, byter de som ar fel
5. Filtrering: Alla / Att granska / Godkanda / Omatchade

## 5. Export

Excel-export av avstamningsresultat (matchade och omatchade transaktioner).

## Avgransningar (YAGNI)

- Ingen automatisk godkanning — Anne godkanner alltid sjalv
- Bara Swedbank-kontot
- Ingen andringshistorik
