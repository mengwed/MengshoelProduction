'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'
import SearchInput from '@/components/SearchInput'
import ReparseAllButton from '@/components/ReparseAllButton'

export default function OvrigaDokumentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const kategoriFilter = searchParams.get('kategori')

  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [showReparseButton, setShowReparseButton] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(j => {
      const s = j.data ?? j
      setShowReparseButton(s.show_reparse_button ?? false)
    })
  }, [])

  function toggleFilter(key: string) {
    setActiveFilter(prev => prev === key ? null : key)
  }

  const fetchDocuments = useCallback(async () => {
    const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
    const res = await fetch(`/api/documents?type=other${searchParam}`)
    const json = await res.json()
    const docs = json.data ?? json
    setDocuments(Array.isArray(docs) ? docs : [])
  }, [searchQuery])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const govFees = documents.filter(d => d.type === 'government_fee')
  const loans = documents.filter(d => d.type === 'loan_statement')
  const receipts = documents.filter(d => d.type === 'receipt')
  const insuranceDocs = documents.filter(d => d.type === 'insurance')
  const statements = documents.filter(d => d.type === 'credit_card_statement')
  const rest = documents.filter(d => !['government_fee', 'loan_statement', 'receipt', 'insurance', 'credit_card_statement'].includes(d.type))
  const needsReview = documents.filter(d => d.ai_needs_review).length
  const vatPaidToSkv = documents
    .filter(d => d.category_name?.toLowerCase() === 'moms')
    .reduce((sum, d) => sum + (d.total ?? d.amount ?? 0), 0)

  let displayDocs = documents
  if (kategoriFilter) {
    displayDocs = documents.filter(d => d.category_name?.toLowerCase() === kategoriFilter.toLowerCase())
  } else if (activeFilter === 'government_fee') {
    displayDocs = govFees
  } else if (activeFilter === 'loan_statement') {
    displayDocs = loans
  } else if (activeFilter === 'receipt') {
    displayDocs = receipts
  } else if (activeFilter === 'insurance') {
    displayDocs = insuranceDocs
  } else if (activeFilter === 'credit_card_statement') {
    displayDocs = statements
  } else if (activeFilter === 'review') {
    displayDocs = documents.filter(d => d.ai_needs_review)
  } else if (activeFilter === 'moms') {
    displayDocs = documents.filter(d => d.category_name?.toLowerCase() === 'moms')
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Övriga dokument</h1>
        <div className="flex flex-wrap items-center gap-2">
          {showReparseButton && <ReparseAllButton onComplete={fetchDocuments} />}
          <SearchInput onSearch={setSearchQuery} placeholder="Sök dokument..." />
          <a
            href="/api/documents/export?type=other"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Exportera Excel
          </a>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
          >
            + Ladda upp
          </button>
        </div>
      </div>

      <SummaryBoxes boxes={[
        { label: 'Myndighetsavgifter', value: govFees.length, icon: '🏛️', format: 'number', onClick: () => toggleFilter('government_fee'), active: activeFilter === 'government_fee' },
        { label: 'Låneaviseringar', value: loans.length, icon: '🏦', format: 'number', onClick: () => toggleFilter('loan_statement'), active: activeFilter === 'loan_statement' },
        { label: 'Kvitton', value: receipts.length, icon: '🧾', format: 'number', onClick: () => toggleFilter('receipt'), active: activeFilter === 'receipt' },
        { label: 'Försäkringar', value: insuranceDocs.length, icon: '🛡️', format: 'number', onClick: () => toggleFilter('insurance'), active: activeFilter === 'insurance' },
        { label: 'Kontoutdrag', value: statements.length, icon: '🏧', format: 'number', onClick: () => toggleFilter('credit_card_statement'), active: activeFilter === 'credit_card_statement' },
        { label: 'Att granska', value: needsReview, icon: '⚠️', format: 'number', onClick: () => toggleFilter('review'), active: activeFilter === 'review' },
        { label: 'Betald moms till SKV', value: vatPaidToSkv, icon: '🏦', onClick: () => toggleFilter('moms'), active: activeFilter === 'moms' },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload onUploadComplete={fetchDocuments} />
        </div>
      )}

      {kategoriFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Filtrerar på kategori: <span className="text-white font-medium">{kategoriFilter}</span>
          </span>
          <button
            onClick={() => router.push('/ovriga-dokument')}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Visa alla
          </button>
        </div>
      )}

      <DocumentList documents={displayDocs} onUpdate={fetchDocuments} highlightId={searchParams.get('doc') || undefined} />
    </div>
  )
}
