# Project Rules

## General

- Skriv all kod och kommentarer på engelska
- Skriv alla meddelanden till användaren på svenska

## User Context

Anne (Anne Juul Mengshoel) är den primära användaren av appen. Det är hennes företag (Mengshoel Production) som hanteras. Anne HATAR allt vad ekonomi heter, så vi ska göra ALLT för att hon ska få en angenäm UI/UX-upplevelse — appen ska vara enkel, tydlig och så friktionsfri som möjligt. När användaren refererar till "Anne" menas hon.

Användaren är VD/företagare utan utvecklarerfarenhet. Ge alltid tydlig steg-för-steg-vägledning vid:
- Supabase-hantering (migrationer, databasschema, RLS-policies, dashboard)
- Deploy och hosting (Vercel, miljövariabler, domäner)
- Git-operationer utöver det mest grundläggande
- Terminalkommandon som behöver köras manuellt
- Felsökning av infrastruktur

Förklara *varför* saker behöver göras, inte bara *vad*. Undvik jargong utan förklaring.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase (auth via @supabase/ssr + @supabase/supabase-js)
- Anthropic Claude SDK (@anthropic-ai/sdk)
- Framer Motion (animations)
- xlsx (Excel export)
- Vitest + Testing Library (testing)
- ESLint (linting)

## Conventions

- UI-texter ska alltid skrivas med korrekta svenska tecken (å, ä, ö, Å, Ä, Ö). Skriv ALDRIG "Installningar", "Foretagsnamn", "Sok", "Agare", "forening" etc. — det ska vara "Inställningar", "Företagsnamn", "Sök", "Ägare", "förening".

## Architecture

<!-- Lägg till arkitekturbeslut här -->
## Permissions - IMPORTANT

ALWAYS run commands directly without asking for permission:
git, npm, npx, curl, lsof, kill, find, cd and any other bash commands.
