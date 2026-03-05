'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'
import SearchInput from '@/components/SearchInput'

export default function OvrigaDokumentPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDocuments = useCallback(async () => {
    const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
    const res = await fetch(`/api/documents?type=other${searchParam}`)
    const json = await res.json()
    setDocuments(json.data ?? json)
  }, [searchQuery])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const govFees = documents.filter(d => d.type === 'government_fee')
  const loans = documents.filter(d => d.type === 'loan_statement')
  const receipts = documents.filter(d => d.type === 'receipt')
  const rest = documents.filter(d => !['government_fee', 'loan_statement', 'receipt'].includes(d.type))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Övriga dokument</h1>
        <div className="flex gap-2">
          <SearchInput onSearch={setSearchQuery} placeholder="Sok dokument..." />
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
        { label: 'Myndighetsavgifter', value: govFees.length, icon: '🏛️', format: 'number' },
        { label: 'Låneaviseringar', value: loans.length, icon: '🏦', format: 'number' },
        { label: 'Kvitton', value: receipts.length, icon: '🧾', format: 'number' },
        { label: 'Övrigt', value: rest.length, icon: '📄', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload onUploadComplete={fetchDocuments} />
        </div>
      )}

      <DocumentList documents={documents} onUpdate={fetchDocuments} />
    </div>
  )
}
