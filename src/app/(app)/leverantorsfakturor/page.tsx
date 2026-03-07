'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'
import SearchInput from '@/components/SearchInput'
import ReparseAllButton from '@/components/ReparseAllButton'

export default function LeverantörsfakturorPage() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('doc') || undefined
  const year = searchParams.get('year')
  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReview, setFilterReview] = useState(false)
  const [hideStatus, setHideStatus] = useState(true)
  const [showReparseButton, setShowReparseButton] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(j => {
      const s = j.data ?? j
      setShowReparseButton(s.show_reparse_button ?? false)
    })
  }, [])

  const fetchDocuments = useCallback(async () => {
    const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
    const res = await fetch(`/api/documents?type=incoming${searchParam}`)
    const json = await res.json()
    setDocuments(json.data ?? json)
  }, [searchQuery, year])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const totalExpenses = documents.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const totalVat = documents.reduce((sum, d) => sum + (d.vat ?? 0), 0)
  const needsReview = documents.filter((d) => d.ai_needs_review).length

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Leverantörsfakturor</h1>
        <div className="flex flex-wrap items-center gap-2">
          {showReparseButton && <ReparseAllButton onComplete={fetchDocuments} />}
          <SearchInput onSearch={setSearchQuery} placeholder="Sök dokument..." />
          <a
            href="/api/documents/export?type=incoming"
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
        { label: 'Kostnader (ex moms)', value: totalExpenses, icon: '📦' },
        { label: 'Ingående moms', value: totalVat, icon: '🧾' },
        { label: 'Antal', value: documents.length, icon: '📄', format: 'number' },
        { label: 'Att granska', value: needsReview, icon: '⚠️', format: 'number', onClick: () => setFilterReview(f => !f), active: filterReview },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload typeHint="incoming" onUploadComplete={fetchDocuments} />
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setHideStatus(v => !v)}
          className={`relative w-10 h-5 rounded-full transition-colors ${hideStatus ? 'bg-purple-600' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hideStatus ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className="text-sm text-gray-400">Dölj status</span>
      </div>

      <DocumentList documents={filterReview ? documents.filter(d => d.ai_needs_review) : documents} onUpdate={fetchDocuments} highlightId={highlightId} hideStatus={hideStatus} />
    </div>
  )
}
