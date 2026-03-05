'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Document } from '@/types'
import DocumentPanel from '@/components/DocumentPanel'

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

interface Props {
  filterParam: string
  filterId: number
}

export default function LinkedDocuments({ filterParam, filterId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

  async function fetchDocs() {
    const res = await fetch(`/api/documents?${filterParam}=${filterId}`)
    const data = await res.json()
    if (Array.isArray(data)) setDocuments(data)
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [filterParam, filterId])

  function formatDate(date: string | null) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('sv-SE')
  }

  function formatAmount(amount: number | null) {
    if (amount == null) return '-'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency', currency: 'SEK',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-2">Laddar dokument...</p>
  }

  if (documents.length === 0) {
    return <p className="text-gray-500 text-sm py-2">Inga kopplade dokument</p>
  }

  const total = documents.reduce((sum, d) => sum + (d.total ?? d.amount ?? 0), 0)

  return (
    <>
      <div className="mt-2 rounded-lg overflow-hidden border border-gray-800/50">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/30">
              <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase">Datum</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase">Typ</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase">Fakturanr</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Belopp</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Moms</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="border-t border-gray-800/30 hover:bg-gray-800/20 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2 text-gray-300 text-sm">{formatDate(doc.invoice_date)}</td>
                <td className="px-3 py-2 text-gray-400 text-sm">{TYPE_LABELS[doc.type] || doc.type}</td>
                <td className="px-3 py-2 text-gray-400 text-sm">{doc.invoice_number || '-'}</td>
                <td className="px-3 py-2 text-white text-sm text-right font-mono">{formatAmount(doc.total ?? doc.amount)}</td>
                <td className="px-3 py-2 text-gray-400 text-sm text-right font-mono">{formatAmount(doc.vat)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700">
              <td colSpan={3} className="px-3 py-2 text-xs text-gray-500 uppercase">Totalt ({documents.length} st)</td>
              <td className="px-3 py-2 text-white text-sm text-right font-mono font-medium">{formatAmount(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <AnimatePresence>
        {selectedDoc && (
          <DocumentPanel
            document={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onUpdate={() => { setSelectedDoc(null); fetchDocs() }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
