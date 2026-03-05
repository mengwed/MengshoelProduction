import { createClient } from '@/lib/supabase/server'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9åäö]/g, '')
}

function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8

  // Simple character overlap
  const setA = new Set(na.split(''))
  const setB = new Set(nb.split(''))
  const intersection = [...setA].filter((c) => setB.has(c)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

export async function findMatchingCustomer(name: string) {
  const supabase = await createClient()
  const { data: customers } = await supabase.from('customers').select('*')
  if (!customers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const customer of customers) {
    const score = similarity(name, customer.name)
    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestMatch = customer
    }
  }

  return bestMatch
}

export async function findMatchingSupplier(name: string) {
  const supabase = await createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*')
  if (!suppliers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const supplier of suppliers) {
    const score = similarity(name, supplier.name)
    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestMatch = supplier
    }
  }

  return bestMatch
}

export async function findMatchingInvoice(referenceNumber: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('invoice_number', referenceNumber)
    .limit(1)
    .single()

  return data
}
