'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'

interface Anomaly {
  supplier: string
  amount: number
  average: number
  message: string
}

interface MissingRecurring {
  supplier: string
  lastSeen: string
  message: string
}

interface MonthlyBreakdown {
  month: string
  income: number
  expenses: number
}

interface DashboardData {
  income: number
  income_vat: number
  expenses: number
  expenses_vat: number
  result: number
  vat_to_pay: number
  document_count: number
  needs_review_count: number
  anomalies: Anomaly[]
  missing_recurring: MissingRecurring[]
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [reviewDocs, setReviewDocs] = useState<Document[]>([])

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => setStats(d.data ?? d))
    fetch('/api/documents?needsReview=true').then(r => r.json()).then(d => {
      const docs = d.data ?? d
      if (Array.isArray(docs)) setReviewDocs(docs)
    })
  }, [])

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
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <SummaryBoxes boxes={[
        { label: 'Intäkter', value: stats.income, icon: '💰' },
        { label: 'Utgående moms', value: stats.income_vat, icon: '🧾' },
        { label: 'Kostnader', value: stats.expenses, icon: '📦' },
        { label: 'Ingående moms', value: stats.expenses_vat, icon: '🧾' },
        { label: 'Resultat', value: stats.result, icon: '📊' },
        { label: 'Moms att betala', value: stats.vat_to_pay, icon: '🏦' },
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
          {stats.anomalies.length > 0 && (
            <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-orange-400">🔍</span> Ovanliga belopp
              </h2>
              <div className="space-y-2">
                {stats.anomalies.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
                  >
                    <p className="text-orange-300 text-sm">{a.message}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Missing recurring */}
          {stats.missing_recurring.length > 0 && (
            <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">📅</span> Saknade fakturor
              </h2>
              <p className="text-gray-500 text-xs mb-3">Återkommande leverantörer utan nylig faktura</p>
              <div className="space-y-2">
                {stats.missing_recurring.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                  >
                    <p className="text-blue-300 text-sm">{m.message}</p>
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
