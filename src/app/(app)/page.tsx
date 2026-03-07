'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'

interface Anomaly {
  supplier: string
  amount: number
  average: number
  message: string
  document_id: string
  doc_type: string
}

interface MissingRecurring {
  supplier: string
  lastSeen: string
  message: string
  document_id: string | null
  doc_type: string | null
}

function docPagePath(docType: string | null) {
  if (docType === 'outgoing_invoice') return '/kundfakturor'
  if (docType === 'incoming_invoice') return '/leverantorsfakturor'
  return '/ovriga-dokument'
}

interface MonthlyBreakdown {
  month: string
  income: number
  expenses: number
}

interface InvoiceWarning {
  type: 'gap' | 'duplicate'
  message: string
}

interface DashboardData {
  income: number
  income_vat: number
  expenses: number
  expenses_vat: number
  result: number
  vat_to_pay: number
  vat_payments: number
  vat_paid_marked: number
  document_count: number
  needs_review_count: number
  anomalies: Anomaly[]
  missing_recurring: MissingRecurring[]
  invoice_warnings: InvoiceWarning[]
  monthly_breakdown: MonthlyBreakdown[]
}

function formatSEK(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function MonthlyChart({ data }: { data: MonthlyBreakdown[] }) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1)

  const monthNames: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Maj', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dec',
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Intäkter vs Kostnader per månad</h2>
      <div className="flex items-end gap-2 h-48">
        {data.map((d, i) => {
          const mm = d.month.split('-')[1]
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end w-full justify-center h-36">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.income / maxVal) * 100}%` }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className="w-3 bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                  title={`Intäkter: ${formatSEK(d.income)}`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.expenses / maxVal) * 100}%` }}
                  transition={{ delay: i * 0.05 + 0.1, duration: 0.5 }}
                  className="w-3 bg-gradient-to-t from-pink-600 to-pink-400 rounded-t"
                  title={`Kostnader: ${formatSEK(d.expenses)}`}
                />
              </div>
              <span className="text-xs text-gray-500">{monthNames[mm] || mm}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Intäkter
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-pink-500" /> Kostnader
        </div>
      </div>
    </div>
  )
}

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Document[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/documents?search=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => {
          const docs = d.data ?? d
          setResults(Array.isArray(docs) ? docs.slice(0, 8) : [])
        })
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function getDocHref(doc: Document) {
    const base = doc.type === 'outgoing_invoice' ? '/kundfakturor'
      : doc.type === 'incoming_invoice' ? '/leverantorsfakturor'
      : '/ovriga-dokument'
    return `${base}?doc=${doc.id}`
  }

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          placeholder="Sök fakturor, leverantörer, kunder..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.map(doc => (
            <button
              key={doc.id}
              onClick={() => { setOpen(false); setQuery(''); router.push(getDocHref(doc)) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{doc.file_name}</p>
                <p className="text-gray-500 text-xs">
                  {doc.supplier_name || doc.customer_name || 'Okänd'} — {doc.invoice_date ? new Date(doc.invoice_date).toLocaleDateString('sv-SE') : 'Inget datum'}
                  {doc.amount != null && ` — ${formatSEK(doc.amount)}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [reviewDocs, setReviewDocs] = useState<Document[]>([])
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set())
  const [dismissedMissing, setDismissedMissing] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => setStats(d.data ?? d))
    fetch('/api/documents?needsReview=true').then(r => r.json()).then(d => {
      const docs = d.data ?? d
      if (Array.isArray(docs)) setReviewDocs(docs)
    })
    try {
      const da = localStorage.getItem('dismissed_anomalies')
      const dm = localStorage.getItem('dismissed_missing')
      if (da) setDismissedAnomalies(new Set(JSON.parse(da)))
      if (dm) setDismissedMissing(new Set(JSON.parse(dm)))
    } catch {}
  }, [])

  function dismissAnomaly(key: string) {
    setDismissedAnomalies(prev => {
      const next = new Set(prev).add(key)
      localStorage.setItem('dismissed_anomalies', JSON.stringify([...next]))
      return next
    })
  }

  function dismissMissing(key: string) {
    setDismissedMissing(prev => {
      const next = new Set(prev).add(key)
      localStorage.setItem('dismissed_missing', JSON.stringify([...next]))
      return next
    })
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>
        <p className="text-gray-400">Laddar...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <GlobalSearch />
      </div>

      {/* Invoice number warnings — shown prominently at the top */}
      {stats.invoice_warnings.length > 0 && (
        <div className="space-y-3 mb-6">
          {stats.invoice_warnings.map((w) => (
            <motion.div
              key={w.message}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 bg-red-500/10 border-2 border-red-500/40 rounded-xl flex items-start gap-4"
            >
              <span className="text-3xl shrink-0">{w.type === 'duplicate' ? '⚠️' : '🚨'}</span>
              <div>
                <h3 className="text-red-300 font-bold text-base mb-1">
                  {w.type === 'duplicate' ? 'Dubbletter i fakturanummer' : 'Lucka i fakturanummerserie'}
                </h3>
                <p className="text-red-200/80 text-sm leading-relaxed">{w.message}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <SummaryBoxes boxes={[
        { label: 'Intäkter (ex moms)', value: stats.income, icon: '💰' },
        { label: 'Moms att betala', value: stats.vat_to_pay, icon: '🏦', subtitle: stats.vat_paid_marked > 0 ? `${formatSEK(stats.vat_paid_marked)} markerad som betald` : undefined },
        { label: 'Kostnader', value: stats.expenses, icon: '📦' },
        { label: 'Resultat', value: stats.result, icon: '📊' },
        { label: 'Inbetald moms (till SKV)', value: stats.vat_payments, icon: '💸', onClick: () => router.push('/ovriga-dokument?kategori=moms') },
      ]} />

      {/* Monthly chart */}
      {stats.monthly_breakdown.length > 0 && (
        <div className="mt-8">
          <MonthlyChart data={stats.monthly_breakdown} />
        </div>
      )}

      {/* AI Alerts section */}
      {(stats.anomalies.length > 0 || stats.missing_recurring.length > 0 || reviewDocs.length > 0) && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anomalies */}
          {stats.anomalies.filter(a => !dismissedAnomalies.has(a.message)).length > 0 && (
            <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-orange-400">🔍</span> Ovanliga belopp
              </h2>
              <div className="space-y-2">
                {stats.anomalies.filter(a => !dismissedAnomalies.has(a.message)).map((a, i) => (
                  <motion.div
                    key={a.message}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => router.push(`${docPagePath(a.doc_type)}?doc=${a.document_id}`)}
                      className="text-orange-300 text-sm text-left hover:text-orange-200 transition-colors"
                    >
                      {a.message}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissAnomaly(a.message) }}
                      className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 p-1"
                      title="Dölj"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Missing recurring */}
          {stats.missing_recurring.filter(m => !dismissedMissing.has(m.message)).length > 0 && (
            <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">📅</span> Saknade fakturor
              </h2>
              <p className="text-gray-500 text-xs mb-3">Återkommande leverantörer utan nylig faktura</p>
              <div className="space-y-2">
                {stats.missing_recurring.filter(m => !dismissedMissing.has(m.message)).map((m, i) => (
                  <motion.div
                    key={m.message}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => m.document_id && router.push(`${docPagePath(m.doc_type)}?doc=${m.document_id}`)}
                      className="text-blue-300 text-sm text-left hover:text-blue-200 transition-colors"
                    >
                      {m.message}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissMissing(m.message) }}
                      className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 p-1"
                      title="Dölj"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Needs review */}
          {reviewDocs.length > 0 && (
            <div className="bg-gray-900 border border-yellow-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-yellow-400">⚠️</span> Att granska ({reviewDocs.length})
              </h2>
              <div className="space-y-2">
                {reviewDocs.slice(0, 5).map((doc, i) => (
                  <motion.a
                    key={doc.id}
                    href={doc.type === 'outgoing_invoice' ? '/kundfakturor' : '/leverantorsfakturor'}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg hover:border-yellow-500/40 transition-colors block"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{doc.file_name}</p>
                      <p className="text-gray-500 text-xs">
                        {doc.invoice_date ? new Date(doc.invoice_date).toLocaleDateString('sv-SE') : 'Inget datum'} — AI {doc.ai_confidence}% säker
                      </p>
                    </div>
                  </motion.a>
                ))}
                {reviewDocs.length > 5 && (
                  <p className="text-gray-500 text-xs text-center">+ {reviewDocs.length - 5} till</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
