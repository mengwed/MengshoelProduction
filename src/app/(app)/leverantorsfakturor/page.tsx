'use client'

import { useState, useEffect } from 'react'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'

export default function LeverantorsfakturorPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)

  async function fetchDocuments() {
    const res = await fetch('/api/documents?type=incoming')
    const data = await res.json()
    setDocuments(data)
  }

  useEffect(() => { fetchDocuments() }, [])

  const totalExpenses = documents.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const totalVat = documents.reduce((sum, d) => sum + (d.vat ?? 0), 0)
  const needsReview = documents.filter((d) => d.ai_needs_review).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Leverantorsfakturor</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Ladda upp
        </button>
      </div>

      <SummaryBoxes boxes={[
        { label: 'Kostnader', value: totalExpenses, icon: '📦' },
        { label: 'Ingaende moms', value: totalVat, icon: '🧾' },
        { label: 'Antal', value: documents.length, icon: '📄', format: 'number' },
        { label: 'Att granska', value: needsReview, icon: '⚠️', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload typeHint="incoming" onUploadComplete={fetchDocuments} />
        </div>
      )}

      <DocumentList documents={documents} onUpdate={fetchDocuments} />
    </div>
  )
}
