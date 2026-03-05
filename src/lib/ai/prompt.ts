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
