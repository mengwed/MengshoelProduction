'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { DashboardStats, Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [reviewDocs, setReviewDocs] = useState<Document[]>([])

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setStats)
    fetch('/api/documents?needsReview=true').then(r => r.json()).then(setReviewDocs)
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
        { label: 'Intakter', value: stats.income, icon: '💰' },
        { label: 'Utgaende moms', value: stats.income_vat, icon: '🧾' },
        { label: 'Kostnader', value: stats.expenses, icon: '📦' },
        { label: 'Ingaende moms', value: stats.expenses_vat, icon: '🧾' },
        { label: 'Resultat', value: stats.result, icon: '📊' },
        { label: 'Moms att betala', value: stats.vat_to_pay, icon: '🏦' },
      ]} />

      {reviewDocs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Att granska ({reviewDocs.length})
          </h2>
          <div className="space-y-2">
            {reviewDocs.map((doc, i) => (
              <motion.a
                key={doc.id}
                href={doc.type === 'outgoing_invoice' ? '/kundfakturor' : '/leverantorsfakturor'}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gray-900 border border-yellow-500/30 rounded-lg hover:border-yellow-500/50 transition-colors"
              >
                <span className="text-yellow-400">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{doc.file_name}</p>
                  <p className="text-gray-500 text-xs">
                    {doc.invoice_date ? new Date(doc.invoice_date).toLocaleDateString('sv-SE') : 'Inget datum'} — AI {doc.ai_confidence}% saker
                  </p>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
