import { createServiceClient } from '@/lib/supabase/server'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zåäö0-9 ]/g, '').trim()
}

function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1

  // Check if one fully contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.85

  // Word-based matching (much better than character overlap)
  const wordsA = na.split(/\s+/).filter(w => w.length > 1)
  const wordsB = nb.split(/\s+/).filter(w => w.length > 1)

  // Skip common filler words
  const skip = new Set(['ab', 'i', 'och', 'the', 'of', 'inc', 'ltd', 'co', 'publ'])
  const sigA = wordsA.filter(w => !skip.has(w))
  const sigB = wordsB.filter(w => !skip.has(w))

  if (sigA.length === 0 || sigB.length === 0) return 0

  // Count matching significant words
  let matches = 0
  for (const wa of sigA) {
    for (const wb of sigB) {
      if (wa === wb || wa.includes(wb) || wb.includes(wa)) {
        matches++
        break
      }
    }
  }

  return matches / Math.max(sigA.length, sigB.length)
}

export async function findMatchingCustomer(name: string) {
  const supabase = createServiceClient()
  const { data: customers } = await supabase.from('customers').select('*')
  if (!customers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const customer of customers) {
    const score = similarity(name, customer.name)
    if (score > bestScore && score >= 0.7) {
      bestScore = score
      bestMatch = customer
    }
  }

  return bestMatch
}

export async function findMatchingSupplier(name: string) {
  const supabase = createServiceClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*')
  if (!suppliers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const supplier of suppliers) {
    const score = similarity(name, supplier.name)
    if (score > bestScore && score >= 0.7) {
      bestScore = score
      bestMatch = supplier
    }
  }

  return bestMatch
}

export async function findMatchingInvoice(referenceNumber: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('invoice_number', referenceNumber)
    .limit(1)
    .single()

  return data
}
