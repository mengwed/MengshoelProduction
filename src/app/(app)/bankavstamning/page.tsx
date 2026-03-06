'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SummaryBoxes from '@/components/SummaryBoxes'
import type { BankTransaction } from '@/types'

type Filter = 'all' | 'matched' | 'unmatched'

interface ImportResult {
  imported: number
  matched: number
  unmatched: number
  duplicates?: number
  balance_warning?: string | null
}

interface SearchDoc {
  id: string
  file_name: string
  type: string
  invoice_number: string | null
  total: number | null
  supplier_name?: string
  customer_name?: string
}

export default function BankavstamningPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchDoc[]>([])

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    const res = await fetch('/api/bank/transactions')
    const json = await res.json()
    const data = json.data ?? json
    if (Array.isArray(data)) setTransactions(data)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/bank/import', { method: 'POST', body: formData })
    const json = await res.json()
    const data = json.data ?? json

    if (res.ok) {
      setImportResult(data)
      fetchTransactions()
    }

    setUploading(false)
  }

  const searchDocuments = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/documents?search=${encodeURIComponent(query)}`)
    const json = await res.json()
    setSearchResults((json.data ?? json).slice(0, 10))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (matchingTxId) searchDocuments(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, matchingTxId, searchDocuments])

  async function handleMatch(txId: string, documentId: string) {
    await fetch(`/api/bank/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matched_document_id: documentId }),
    })
    setMatchingTxId(null)
    setSearchQuery('')
    fetchTransactions()
  }

  async function handleUnlink(txId: string) {
    await fetch(`/api/bank/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matched_document_id: null }),
    })
    fetchTransactions()
  }

  const matched = transactions.filter(t => t.matched_document_id)
  const unmatched = transactions.filter(t => !t.matched_document_id)

  const filtered = filter === 'matched' ? matched
    : filter === 'unmatched' ? unmatched
    : transactions

  function formatDate(date: string | null) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('sv-SE')
  }

  function formatAmount(amount: number) {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency', currency: 'SEK',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount)
  }

  function confidenceBadge(confidence: number | null) {
    if (confidence === null) return null
    const pct = Math.round(confidence * 100)
    const color = confidence >= 0.9 ? 'text-green-400' :
                  confidence >= 0.7 ? 'text-yellow-400' : 'text-red-400'
    return <span className={`text-xs ${color} ml-2`}>{pct}%</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Bankavstamning</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Importera Excel
        </button>
      </div>

      <SummaryBoxes boxes={[
        { label: 'Transaktioner', value: transactions.length, icon: '🏦', format: 'number' },
        { label: 'Matchade', value: matched.length, icon: '✅', format: 'number' },
        { label: 'Saknar kvitto', value: unmatched.length, icon: '❌', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm mb-4">Ladda upp kontoutdrag (Excel-format)</p>
          <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
            {uploading ? 'Importerar...' : 'Valj Excel-fil'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {importResult && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">
                  Importerade {importResult.imported} transaktioner. {importResult.matched} matchade, {importResult.unmatched} omatchade.
                  {importResult.duplicates ? ` ${importResult.duplicates} duplikater ignorerade.` : ''}
                </p>
              </div>
              {importResult.balance_warning && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">{importResult.balance_warning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'matched', 'unmatched'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Alla' : f === 'matched' ? 'Matchade' : 'Omatchade'}
          </button>
        ))}
      </div>

      {/* Manual matching modal */}
      <AnimatePresence>
        {matchingTxId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => { setMatchingTxId(null); setSearchQuery('') }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold mb-4">Matcha med dokument</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök på filnamn, fakturanummer, leverantör..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchResults.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleMatch(matchingTxId, doc.id)}
                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="text-white text-sm">{doc.file_name}</div>
                    <div className="text-gray-400 text-xs">
                      {doc.invoice_number && `#${doc.invoice_number} · `}
                      {doc.total && formatAmount(doc.total)}
                      {(doc.supplier_name || doc.customer_name) && ` · ${doc.supplier_name || doc.customer_name}`}
                    </div>
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">Inga dokument hittades</p>
                )}
              </div>
              <button
                onClick={() => { setMatchingTxId(null); setSearchQuery('') }}
                className="mt-4 text-sm text-gray-400 hover:text-white"
              >
                Avbryt
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Typ</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Referens</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Belopp</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Saldo</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Matchat dokument</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, i) => (
              <motion.tr
                key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`border-b border-gray-800/50 transition-colors ${
                  tx.matched_document_id
                    ? 'hover:bg-green-500/5'
                    : 'hover:bg-red-500/5'
                }`}
              >
                <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(tx.booking_date)}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{tx.transaction_type || '-'}</td>
                <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-xs">{tx.reference || '-'}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${tx.amount >= 0 ? 'text-green-400' : 'text-white'}`}>
                  {formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm text-right font-mono">
                  {tx.balance != null ? formatAmount(tx.balance) : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {tx.documents ? (
                    <span className="text-green-400">
                      {tx.documents.file_name}
                      {confidenceBadge(tx.match_confidence)}
                    </span>
                  ) : (
                    <span className="text-red-400/60">Inget kvitto</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {tx.matched_document_id ? (
                    <button
                      onClick={() => handleUnlink(tx.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Avlanka
                    </button>
                  ) : (
                    <button
                      onClick={() => setMatchingTxId(tx.id)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Matcha
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {transactions.length === 0 ? 'Inga transaktioner importerade' : 'Inga transaktioner matchar filtret'}
          </p>
        )}
      </div>
    </div>
  )
}
