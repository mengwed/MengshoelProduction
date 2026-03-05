# TODO - AJ Bokforingsapp

## KRITISKT - Sakerhet

- [x] Lagg till auth-kontroller pa alla API-routes (verifiera session per request)
- [ ] Fixxa RLS-policies - alla autentiserade anvandare kan se/andra all data (schema.sql rad 137-150)
- [x] Lagg till input-validering med Zod pa alla API-routes
- [x] Lagg till rate limiting pa API-routes (forhindra spam-uppladdning)
- [x] Lagg till request size limits pa filuppladdning
- [x] Sanera AI-extraherad data innan DOM-rendering (XSS-risk i dashboard)

## HOGT - Databas & Migrationer

- [x] Migrera fran ra SQL-filer till Supabase migrations-system
- [x] Lagg till UNIQUE constraint pa suppliers.name, customers.name, categories.name
- [x] Lagg till audit-tabell for att spara anvandarandringar
- [x] Flytta BankTransaction-typ fran bankavstamning/page.tsx till src/types/index.ts

## HOGT - Testning

- [ ] Lagg till komponenttester (DocumentPanel, FileUpload, EntityForm, etc.)
- [x] Lagg till API-route-tester (happy path + felhantering)
- [ ] Lagg till integrationstester for kritiska floden (uppladdning -> AI-extraktion -> matchning)
- [x] Testa bankmatching-algoritmen med fler edge cases
- [ ] Lagg till tester for AI-extraktion (mocka Claude API)

## HOGT - Felhantering

- [x] Fixa tyst PDF-laddningsfel i DocumentPanel (rad 55 - `.catch(() => {})`)
- [x] Fixa felhantering vid AI-extraktion - uppladdning skapar dokument aven om AI failar
- [x] Lagg till React error boundaries
- [x] Gora felmeddelanden konsekvent format over alla API-routes
- [ ] Lagg till bra felmeddelanden for anvandaren vid misslyckade operationer

## MEDEL - Kodkvalitet

- [ ] Extrahera formatDate() och formatAmount() till src/lib/format.ts (duplicerad i 4+ komponenter)
- [ ] Skapa custom hooks for data-fetching (useDocuments, useCustomers, etc.)
- [ ] Ersatt `as unknown as` casts med typsakrare alternativ
- [ ] Lagg till optional chaining for nasted objekt dar null ar mojligt
- [ ] Memorisera dashboard-berakningar (useMemo)
- [ ] Filtrera fore map i DocumentList for battre prestanda

## MEDEL - AI-forbattringar

- [ ] Gora AI-prompten dynamisk (hardkodad for "Mengshoel Production" i prompt.ts rad 1)
- [ ] Inkludera senaste ai_corrections automatiskt i extraktions-prompten
- [ ] Validera att AI-extraherade belopp ar rimliga (t.ex. < 1 miljard SEK)
- [ ] Lagg till loggning av alla AI-interaktioner for debugging
- [ ] Hantera AI-fel battre - koa for retry istallet for att skapa tomt dokument

## MEDEL - Bankavstamning

- [ ] Forbattra matchningsalgoritm - lagg till konfidenspoang istallet for binart resultat
- [ ] Lagg till stod for fler banker (inte bara Swedbank)
- [ ] Lagg till manuell matchning/avlankning av transaktioner
- [ ] Lagg till duplikatdetektering for transaktioner
- [ ] Lagg till saldoverifering

## MEDEL - Tillganglighet

- [x] Lagg till title-attribut pa iframe i DocumentPanel (WCAG)
- [ ] Lagg till tillganglighetstext pa stang-knapp i DocumentPanel
- [ ] Lagg till caption pa tabeller
- [ ] Forbattra tangentbordsnavigation

## LAGT - Dokumentation

- [ ] Skriv riktig README.md (projektbeskrivning, setup, features)
- [ ] Dokumentera API-endpoints
- [ ] Skapa .env.local.example med alla nodvandiga miljovaribler
- [ ] Dokumentera databasschema
- [ ] Lagg till deployment-instruktioner

## LAGT - Nya funktioner (framtida)

- [ ] Sokfunktion - fulltext-sokning over dokument
- [ ] Betalningsuppfoljning - paminnelser for obetalda fakturor
- [ ] Automatisk kategorisering baserat pa leverantor
- [ ] Finansiella rapporter (resultatrakning, balansrakning, momsrapport)
- [ ] Stod for flera valutor
- [ ] Fakturagenerering - skapa PDF-fakturor
- [ ] Bulk-import (flera filer samtidigt)
- [ ] Integration med bokforingsprogram (Fortnox, etc.)
- [ ] Notifikationer (e-post for obetalda fakturor, anomalier)
- [ ] Sida for betalningskvitton (payment_received-dokumenttyp saknar dedikerad sida)

## LAGT - Prestanda

- [ ] Lagg till virtualisering/paginering for stora dokumentlistor (1000+ rader)
- [ ] Optimera next.config.ts (bildoptimering, komprimering)
- [ ] Overvagg Framer Motion-overhead pa stora listor
