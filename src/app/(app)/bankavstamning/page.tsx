'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import SummaryBoxes from '@/components/SummaryBoxes'
import type { BankTransaction } from '@/types'

type Filter = 'all' | 'matched' | 'unmatched'

export default function BankavstämningPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; matched: number; unmatched: number } | null>(null)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Bankavstämning</h1>
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
          <p className="text-gray-400 text-sm mb-4">Ladda upp kontoutdrag från Swedbank (Excel-format)</p>
          <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
            {uploading ? 'Importerar...' : 'Välj Excel-fil'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {importResult && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm">
                Importerade {importResult.imported} transaktioner. {importResult.matched} matchade, {importResult.unmatched} omatchade.
              </p>
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
                    <span className="text-green-400">{tx.documents.file_name}</span>
                  ) : (
                    <span className="text-red-400/60">Inget kvitto</span>
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
