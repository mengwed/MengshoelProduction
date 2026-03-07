'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'
import SearchInput from '@/components/SearchInput'
import ReparseAllButton from '@/components/ReparseAllButton'

export default function KundfakturorPage() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('doc') || undefined
  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReview, setFilterReview] = useState(false)

  const fetchDocuments = useCallback(async () => {
    const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
    const res = await fetch(`/api/documents?type=outgoing${searchParam}`)
    const json = await res.json()
    setDocuments(json.data ?? json)
  }, [searchQuery])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const totalInvoiced = documents.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const totalVat = documents.reduce((sum, d) => sum + (d.vat ?? 0), 0)
  const paidCount = documents.filter((d) => d.status === 'paid').length
  const needsReview = documents.filter((d) => d.ai_needs_review).length

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Kundfakturor</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ReparseAllButton onComplete={fetchDocuments} />
          <SearchInput onSearch={setSearchQuery} placeholder="Sök dokument..." />
          <a
            href="/api/documents/export?type=outgoing"
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
        { label: 'Fakturerat (ex moms)', value: totalInvoiced, icon: '💰' },
        { label: 'Moms', value: totalVat, icon: '🧾' },
        { label: 'Antal', value: documents.length, icon: '📄', format: 'number' },
        { label: 'Att granska', value: needsReview, icon: '⚠️', format: 'number', onClick: () => setFilterReview(f => !f), active: filterReview },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload typeHint="outgoing" onUploadComplete={fetchDocuments} />
        </div>
      )}

      <DocumentList documents={filterReview ? documents.filter(d => d.ai_needs_review) : documents} onUpdate={fetchDocuments} highlightId={highlightId} />
    </div>
  )
}
