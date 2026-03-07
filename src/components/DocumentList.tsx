'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Document } from '@/types'
import DocumentPanel from '@/components/DocumentPanel'
import CategoryPicker from '@/components/CategoryPicker'
import Tooltip from '@/components/Tooltip'

const TYPE_LABELS: Record<string, string> = {
  outgoing_invoice: 'Kundfaktura',
  incoming_invoice: 'Leverantörsfaktura',
  payment_received: 'Inbetalning',
  credit_card_statement: 'Kontoutdrag',
  government_fee: 'Myndighetsavgift',
  loan_statement: 'Låneavisering',
  receipt: 'Kvitto',
  insurance: 'Försäkring',
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

type SortKey = 'date' | 'type' | 'name' | 'invoice_number' | 'amount' | 'vat' | 'total' | 'category' | 'status' | 'ai'
type SortDir = 'asc' | 'desc'

interface Props {
  documents: Document[]
  onUpdate: () => void
  highlightId?: string
  hideStatus?: boolean
}

export default function DocumentList({ documents, onUpdate, highlightId, hideStatus }: Props) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1
    return [...documents].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return mult * ((a.invoice_date ?? '').localeCompare(b.invoice_date ?? ''))
        case 'type':
          return mult * ((TYPE_LABELS[a.type] ?? a.type).localeCompare(TYPE_LABELS[b.type] ?? b.type))
        case 'name': {
          const nameA = a.customer_name || a.supplier_name || ''
          const nameB = b.customer_name || b.supplier_name || ''
          return mult * nameA.localeCompare(nameB)
        }
        case 'invoice_number':
          return mult * ((a.invoice_number ?? '').localeCompare(b.invoice_number ?? ''))
        case 'amount':
          return mult * ((a.amount ?? 0) - (b.amount ?? 0))
        case 'vat':
          return mult * ((a.vat ?? 0) - (b.vat ?? 0))
        case 'total':
          return mult * (((a.amount ?? 0) + (a.vat ?? 0)) - ((b.amount ?? 0) + (b.vat ?? 0)))
        case 'category':
          return mult * ((a.category_name ?? '').localeCompare(b.category_name ?? ''))
        case 'status':
          return mult * (a.status.localeCompare(b.status))
        case 'ai':
          return mult * ((a.ai_confidence ?? 0) - (b.ai_confidence ?? 0))
        default:
          return 0
      }
    })
  }, [documents, sortKey, sortDir])

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

  const highlightedRef = useRef(false)
  useEffect(() => {
    if (highlightId && documents.length > 0 && !highlightedRef.current) {
      const doc = documents.find(d => d.id === highlightId)
      if (doc) {
        setSelectedDoc(doc)
        highlightedRef.current = true
      }
    }
  }, [highlightId, documents])

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function SortHeader({ label, col, align }: { label: string; col: SortKey; align?: 'right' | 'center' }) {
    const active = sortKey === col
    return (
      <th
        className={`px-4 py-3 text-xs uppercase tracking-wider cursor-pointer select-none group transition-colors hover:text-gray-200 ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        } ${active ? 'text-purple-400' : 'text-gray-400'}`}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
            {sortDir === 'asc' || !active ? '▲' : '▼'}
          </span>
        </span>
      </th>
    )
  }

  return (
    <>
      {isMobile ? (
        <div className="space-y-3">
          {sorted.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i < 20 ? i * 0.02 : 0 }}
              onClick={() => setSelectedDoc(doc)}
              className="p-4 bg-gray-900 border border-gray-800 rounded-xl active:bg-gray-800 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-white text-sm font-medium truncate mr-2">
                  {doc.customer_name || doc.supplier_name || '-'}
                  {(doc.attachment_count ?? 0) > 0 && (
                    <Tooltip text="Har bifogade filer"><span className="ml-1 text-gray-400">📎</span></Tooltip>
                  )}
                </span>
                <span className="text-white text-sm font-mono whitespace-nowrap">
                  {formatAmount(doc.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatDate(doc.invoice_date)}</span>
                  <span>{TYPE_LABELS[doc.type] || doc.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  {doc.has_bank_match && (
                    <Tooltip text="Kopplad till bankavstämning"><span className="text-xs">🏦</span></Tooltip>
                  )}
                  {doc.type === 'outgoing_invoice' && doc.payment_received && (
                    <Tooltip text="Betalning mottagen"><span className="text-xs">✅</span></Tooltip>
                  )}
                  {doc.type === 'outgoing_invoice' && doc.vat_paid && (
                    <Tooltip text="Momsen för denna faktura är betald">
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-medium">Moms betald</span>
                    </Tooltip>
                  )}
                  {!hideStatus && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                      {STATUS_LABELS[doc.status]}
                    </span>
                  )}
                  {!hideStatus && doc.ai_needs_review && (
                    <Tooltip text="AI:n är osäker — behöver granskas manuellt"><span className="text-yellow-400 text-xs">⚠️</span></Tooltip>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {documents.length === 0 && (
            <p className="text-center text-gray-500 py-8">Inga dokument ännu</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-clip">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-900">
              <tr className="border-b border-gray-800">
                <SortHeader label="Datum" col="date" />
                <SortHeader label="Typ" col="type" />
                <SortHeader label="Kund/Leverantör" col="name" />
                <SortHeader label="Fakturanr" col="invoice_number" />
                <SortHeader label="Belopp" col="amount" align="right" />
                <SortHeader label="Moms" col="vat" align="right" />
                <SortHeader label="Ink moms" col="total" align="right" />
                <SortHeader label="Kategori" col="category" />
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-gray-400 text-center w-10">
                  <Tooltip text="Kopplad till bankavstämning" position="bottom"><span>🏦</span></Tooltip>
                </th>
                {!hideStatus && <SortHeader label="Status" col="status" align="center" />}
                {!hideStatus && <SortHeader label="AI" col="ai" align="center" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((doc, i) => (
                <motion.tr
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i < 20 ? i * 0.02 : 0 }}
                  onClick={() => setSelectedDoc(doc)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(doc.invoice_date)}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{TYPE_LABELS[doc.type] || doc.type}</td>
                  <td className="px-4 py-3 text-white text-sm font-medium">
                    {doc.customer_name || doc.supplier_name || '-'}
                    {(doc.attachment_count ?? 0) > 0 && (
                      <Tooltip text="Har bifogade filer"><span className="ml-1.5 text-gray-400">📎</span></Tooltip>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {doc.invoice_number || '-'}
                    {doc.type === 'outgoing_invoice' && doc.payment_received && (
                      <Tooltip text="Betalning mottagen"><span className="ml-1">✅</span></Tooltip>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white text-sm text-right font-mono">{formatAmount(doc.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-gray-400 text-sm font-mono">{formatAmount(doc.vat)}</span>
                    {doc.type === 'outgoing_invoice' && doc.vat_paid && (
                      <Tooltip text="Momsen för denna faktura är betald">
                        <span className="ml-1.5 px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-medium whitespace-nowrap">Betald</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white text-sm text-right font-mono">
                    {formatAmount((doc.amount ?? 0) + (doc.vat ?? 0))}
                  </td>
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
                    {doc.has_bank_match && (
                      <Tooltip text="Kopplad till bankavstämning"><span className="text-emerald-400 text-sm">🏦</span></Tooltip>
                    )}
                  </td>
                  {!hideStatus && (
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                        {STATUS_LABELS[doc.status]}
                      </span>
                    </td>
                  )}
                  {!hideStatus && (
                    <td className="px-4 py-3 text-center">
                      {doc.ai_needs_review ? (
                        <Tooltip text="AI:n är osäker — behöver granskas manuellt"><span className="text-yellow-400 text-sm">⚠️</span></Tooltip>
                      ) : (
                        <Tooltip text={`AI:n är ${doc.ai_confidence}% säker på att uppgifterna stämmer`}><span className="text-green-400 text-sm">{doc.ai_confidence}%</span></Tooltip>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 && (
            <p className="text-center text-gray-500 py-8">Inga dokument ännu</p>
          )}
        </div>
      )}

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
