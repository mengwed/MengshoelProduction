'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SummaryBoxes from '@/components/SummaryBoxes'
import type { BankTransaction } from '@/types'

type Filter = 'all' | 'pending' | 'approved' | 'unmatched' | 'ignored'

interface ImportResult {
  imported: number
  rule_matched: number
  ai_matched: number
  unmatched: number
  duplicates?: number
  balance_warning?: string | null
  ai_error?: string
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
  const [uploadPhase, setUploadPhase] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchDoc[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
    setImportError(null)
    setUploadPhase('Importerar...')

    const formData = new FormData()
    formData.append('file', file)

    // Show AI phase after a delay
    const timer = setTimeout(() => setUploadPhase('Kör AI-matchning...'), 2000)

    const res = await fetch('/api/bank/import', { method: 'POST', body: formData })
    clearTimeout(timer)
    const json = await res.json()
    const data = json.data ?? json

    if (res.ok) {
      setImportResult(data)
      fetchTransactions()
    } else {
      setImportError(data.error || data.message || 'Något gick fel vid importen')
    }

    setUploading(false)
    setUploadPhase(null)
  }

  async function handleExport() {
    const res = await fetch('/api/bank/export')
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'Bankavstamning.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRetryAI() {
    setRetrying(true)
    const res = await fetch('/api/bank/ai-retry', { method: 'POST' })
    const json = await res.json()
    const data = json.data ?? json
    if (res.ok) {
      fetchTransactions()
      if (data.ai_matched > 0) {
        setImportResult(prev => prev ? { ...prev, ai_matched: (prev.ai_matched || 0) + data.ai_matched, ai_error: undefined } : null)
      }
    }
    setRetrying(false)
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

  async function handleAction(txId: string, action: string, documentId?: string) {
    await fetch(`/api/bank/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(documentId ? { action, document_id: documentId } : { action }),
    })
    setMatchingTxId(null)
    setSearchQuery('')
    fetchTransactions()
  }

  // Filter logic
  const pending = transactions.filter(t => t.match_status === 'pending')
  const approved = transactions.filter(t => t.match_status === 'approved' || t.match_status === 'manual')
  const ignored = transactions.filter(t => t.match_status === 'ignored')
  const unmatched = transactions.filter(t => !t.matched_document_id && t.match_status !== 'pending' && t.match_status !== 'ignored')
  const matched = transactions.filter(t => t.matched_document_id || t.match_status === 'pending')

  const filtered = filter === 'pending' ? pending
    : filter === 'approved' ? approved
    : filter === 'unmatched' ? unmatched
    : filter === 'ignored' ? ignored
    : transactions

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Alla', count: transactions.length },
    { key: 'pending', label: 'Att granska', count: pending.length },
    { key: 'approved', label: 'Godkända', count: approved.length },
    { key: 'unmatched', label: 'Omatchade', count: unmatched.length },
    { key: 'ignored', label: 'Ignorerade', count: ignored.length },
  ]

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
    if (confidence === null || confidence === undefined) return null
    const pct = Math.round(confidence * 100)
    const color = confidence >= 0.9 ? 'bg-green-500/20 text-green-400' :
                  confidence >= 0.7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
    return <span className={`text-xs px-1.5 py-0.5 rounded ${color} ml-2`}>{pct}%</span>
  }

  function getSuggestionInfo(tx: BankTransaction) {
    if (tx.match_status === 'ignored') {
      return { type: 'ignored' as const }
    }
    if (tx.match_status === 'approved' || tx.match_status === 'manual') {
      return { type: 'matched' as const, name: tx.documents?.file_name || 'Matchat dokument', docId: tx.matched_document_id }
    }
    if (tx.match_status === 'pending') {
      if (tx.matched_document_id && tx.documents) {
        return { type: 'rule' as const, name: tx.documents.file_name, confidence: tx.match_confidence, docId: tx.matched_document_id }
      }
      if (tx.ai_suggestion_id && tx.ai_suggestion) {
        return { type: 'ai' as const, name: tx.ai_suggestion.file_name, confidence: tx.ai_confidence, docId: tx.ai_suggestion_id }
      }
    }
    return { type: 'unmatched' as const }
  }

  async function openDocument(docId: string, name: string) {
    const res = await fetch(`/api/documents/${docId}/pdf-url`)
    const json = await res.json()
    const url = (json.data ?? json)?.url
    if (url) {
      setPdfUrl(url)
      setPdfName(name)
    }
  }

  function renderDocLink(name: string, docId: string | null | undefined, className: string) {
    if (!docId) return <span className={className}>{name}</span>
    return (
      <button
        onClick={() => openDocument(docId, name)}
        className={`${className} underline decoration-dotted underline-offset-2 hover:brightness-125`}
      >
        {name}
      </button>
    )
  }

  function renderMatchSection(tx: BankTransaction) {
    const info = getSuggestionInfo(tx)

    if (info.type === 'ignored') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Ignorerad</span>
          <button onClick={() => handleAction(tx.id, 'unlink')} className="text-xs text-gray-400 hover:text-white">
            Ångra
          </button>
        </div>
      )
    }

    if (info.type === 'matched') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">✅</span>
          {renderDocLink(info.name, info.docId, 'text-green-400 text-sm')}
          <button onClick={() => handleAction(tx.id, 'unlink')} className="text-xs text-red-400 hover:text-red-300">
            Avlänka
          </button>
        </div>
      )
    }

    if (info.type === 'rule' || info.type === 'ai') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {renderDocLink(info.name, info.docId, 'text-yellow-400 text-sm')}
            {confidenceBadge(info.confidence ?? null)}
            {info.type === 'ai' && <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">AI</span>}
          </div>
          {tx.ai_explanation && <p className="text-gray-500 text-xs">{tx.ai_explanation}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => handleAction(tx.id, 'approve')}
              className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
            >
              Godkänn
            </button>
            <button
              onClick={() => setMatchingTxId(tx.id)}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Byt dokument
            </button>
            <button
              onClick={() => handleAction(tx.id, 'ignore')}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-500 rounded hover:bg-gray-600 hover:text-gray-300"
            >
              Ignorera
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-1">
        <span className="text-red-400/60 text-sm">Ej matchad</span>
        {tx.ai_explanation && <p className="text-gray-500 text-xs">{tx.ai_explanation}</p>}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setMatchingTxId(tx.id)}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Matcha
          </button>
          <button
            onClick={() => handleAction(tx.id, 'ignore')}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Ignorera
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Bankavstämning</h1>
        <div className="flex gap-2">
          {transactions.length > 0 && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Exportera Excel
            </button>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
          >
            + Importera Excel
          </button>
        </div>
      </div>

      {transactions.length > 0 && (() => {
        const dates = transactions.map(t => t.booking_date).sort()
        const fromDate = dates[0]
        const toDate = dates[dates.length - 1]
        const toDateObj = new Date(toDate)
        const isYearEnd = toDateObj.getMonth() === 11 && toDateObj.getDate() === 31
        const year = toDateObj.getFullYear()

        return (
          <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-xl">
            {isYearEnd ? (
              <p className="text-green-400 text-sm">
                Hela år {year} är hämtat från banken 🎉
              </p>
            ) : (
              <p className="text-gray-300 text-sm">
                Transaktioner från banken har körts för datum: <span className="text-white font-medium">{formatDate(fromDate)}</span> – <span className="text-white font-medium">{formatDate(toDate)}</span>.
                Nästa transaktionsfil från banken ska hämtas från datum <span className="text-white font-medium">{formatDate(toDate)}</span>.
              </p>
            )}
          </div>
        )
      })()}

      <SummaryBoxes boxes={[
        { label: 'Transaktioner', value: transactions.length, icon: '🏦', format: 'number' },
        { label: 'Matchade', value: matched.length, icon: '✅', format: 'number' },
        { label: 'Att granska', value: pending.length, icon: '👀', format: 'number' },
        { label: 'Omatchade', value: unmatched.length, icon: '❌', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm mb-4">Ladda upp kontoutdrag (Excel-format)</p>
          <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
            {uploading ? uploadPhase : 'Välj Excel-fil'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {importError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{importError}</p>
            </div>
          )}
          {importResult && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">
                  Importerade {importResult.imported} transaktioner.
                  {importResult.rule_matched > 0 && ` ${importResult.rule_matched} regelbaserade matchningar.`}
                  {importResult.ai_matched > 0 && ` ${importResult.ai_matched} AI-matchningar.`}
                  {importResult.unmatched > 0 && ` ${importResult.unmatched} omatchade.`}
                  {importResult.duplicates ? ` ${importResult.duplicates} duplikater ignorerade.` : ''}
                </p>
              </div>
              {importResult.ai_error && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
                  <p className="text-yellow-400 text-sm">
                    AI-matchning kunde inte köras: {importResult.ai_error}. Regelbaserade förslag visas.
                  </p>
                  <button
                    onClick={handleRetryAI}
                    disabled={retrying}
                    className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 ml-4 whitespace-nowrap"
                  >
                    {retrying ? 'Försöker...' : 'Försök igen'}
                  </button>
                </div>
              )}
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
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === tab.key
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label} ({tab.count})
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
                placeholder="Sök på filnamn, fakturanummer, leverantör, belopp..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchResults.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleAction(matchingTxId, 'manual', doc.id)}
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

      {/* PDF viewer modal */}
      <AnimatePresence>
        {pdfUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => { setPdfUrl(null); setPdfName(null) }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h3 className="text-white font-medium text-sm truncate">{pdfName}</h3>
                <button
                  onClick={() => { setPdfUrl(null); setPdfName(null) }}
                  className="text-gray-400 hover:text-white text-lg px-2"
                >
                  ✕
                </button>
              </div>
              <iframe
                src={pdfUrl}
                className="flex-1 w-full rounded-b-xl"
                title={pdfName || 'Dokument'}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile ? (
        <div className="space-y-3">
          {filtered.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`p-4 bg-gray-900 border rounded-xl ${
                tx.match_status === 'approved' || tx.match_status === 'manual' ? 'border-green-500/20' :
                tx.match_status === 'pending' ? 'border-yellow-500/20' :
                tx.match_status === 'ignored' ? 'border-gray-800 opacity-50' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatDate(tx.booking_date)}</span>
                  <span>{tx.transaction_type || '-'}</span>
                </div>
                <span className={`text-sm font-mono ${tx.amount >= 0 ? 'text-green-400' : 'text-white'}`}>
                  {formatAmount(tx.amount)}
                </span>
              </div>
              {tx.reference && (
                <p className="text-gray-400 text-xs truncate mb-2">{tx.reference}</p>
              )}
              {renderMatchSection(tx)}
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              {transactions.length === 0 ? 'Inga transaktioner importerade' : 'Inga transaktioner matchar filtret'}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Typ</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Referens</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Belopp</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Saldo</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Matchning</th>
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
                    tx.match_status === 'approved' || tx.match_status === 'manual'
                      ? 'hover:bg-green-500/5'
                      : tx.match_status === 'pending'
                      ? 'hover:bg-yellow-500/5'
                      : tx.match_status === 'ignored'
                      ? 'opacity-50 hover:bg-gray-800/50'
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
                  <td className="px-4 py-3">
                    {renderMatchSection(tx)}
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
      )}
    </div>
  )
}
