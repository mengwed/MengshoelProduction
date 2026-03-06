'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Document } from '@/types'
import DocumentPanel from '@/components/DocumentPanel'
import CategoryPicker from '@/components/CategoryPicker'

const TYPE_LABELS: Record<string, string> = {
  outgoing_invoice: 'Kundfaktura',
  incoming_invoice: 'Leverantörsfaktura',
  payment_received: 'Inbetalning',
  credit_card_statement: 'Kontoutdrag',
  government_fee: 'Myndighetsavgift',
  loan_statement: 'Låneavisering',
  receipt: 'Kvitto',
  other: 'Övrigt',
}

const STATUS_COLORS: Record<string, string> = {
  imported: 'bg-yellow-500/20 text-yellow-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
  imported: 'Importerad',
  reviewed: 'Granskad',
  paid: 'Betald',
}

interface Props {
  documents: Document[]
  onUpdate: () => void
}

export default function DocumentList({ documents, onUpdate }: Props) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

  function formatDate(date: string | null) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('sv-SE')
  }

  function formatAmount(amount: number | null) {
    if (amount == null) return '-'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Typ</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Kund/Leverantör</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Fakturanr</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Belopp</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Moms</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Kategori</th>
              <th className="text-center px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">AI</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, i) => (
              <motion.tr
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelectedDoc(doc)}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(doc.invoice_date)}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{TYPE_LABELS[doc.type] || doc.type}</td>
                <td className="px-4 py-3 text-white text-sm font-medium">
                  {doc.customer_name || doc.supplier_name || '-'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{doc.invoice_number || '-'}</td>
                <td className="px-4 py-3 text-white text-sm text-right font-mono">{formatAmount(doc.amount)}</td>
                <td className="px-4 py-3 text-gray-400 text-sm text-right font-mono">{formatAmount(doc.vat)}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <CategoryPicker
                    value={doc.category_id}
                    onChange={async (categoryId) => {
                      await fetch(`/api/documents/${doc.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ category_id: categoryId }),
                      })
                      onUpdate()
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                    {STATUS_LABELS[doc.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {doc.ai_needs_review ? (
                    <span className="text-yellow-400 text-sm" title="Behöver granskas">⚠️</span>
                  ) : (
                    <span className="text-green-400 text-sm">{doc.ai_confidence}%</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && (
          <p className="text-center text-gray-500 py-8">Inga dokument ännu</p>
        )}
      </div>

      <AnimatePresence>
        {selectedDoc && (
          <DocumentPanel
            document={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onUpdate={() => {
              setSelectedDoc(null)
              onUpdate()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
