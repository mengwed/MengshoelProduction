'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadResult {
  file: File
  status: 'uploading' | 'done' | 'error' | 'duplicate'
  document?: Record<string, unknown>
  error?: string
}

interface Props {
  typeHint?: 'outgoing' | 'incoming'
  onUploadComplete: () => void
}

export default function FileUpload({ typeHint, onUploadComplete }: Props) {
  const [results, setResults] = useState<UploadResult[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(async (file: File) => {
    setResults((prev) => [...prev, { file, status: 'uploading' }])

    const formData = new FormData()
    formData.append('file', file)
    if (typeHint) formData.append('typeHint', typeHint)

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.status === 409) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'duplicate', error: data.message } : r
          )
        )
      } else if (!res.ok) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'error', error: data.error } : r
          )
        )
      } else {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'done', document: data } : r
          )
        )
      }
    } catch {
      setResults((prev) =>
        prev.map((r) =>
          r.file === file ? { ...r, status: 'error', error: 'Uppkopplingsfel' } : r
        )
      )
    }
  }, [typeHint])

  async function handleFiles(files: FileList) {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf')
    for (const file of pdfFiles) {
      await uploadFile(file)
    }
    onUploadComplete()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const allDone = results.length > 0 && results.every((r) => r.status !== 'uploading')

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-gray-800 hover:border-gray-600'
        }`}
      >
        <p className="text-gray-400 text-lg mb-2">
          Dra och släpp PDF-filer här
        </p>
        <p className="text-gray-600 text-sm mb-4">eller</p>
        <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
          Välj filer
          <input
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
      </div>

      <AnimatePresence>
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg"
          >
            <span className="text-lg">
              {r.status === 'uploading' && '⏳'}
              {r.status === 'done' && '✅'}
              {r.status === 'error' && '❌'}
              {r.status === 'duplicate' && '⚠️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{r.file.name}</p>
              {r.error && <p className="text-red-400 text-xs">{r.error}</p>}
              {r.status === 'uploading' && (
                <p className="text-gray-500 text-xs">Analyserar med AI...</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {allDone && results.length > 0 && (
        <button
          onClick={() => setResults([])}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Rensa lista
        </button>
      )}
    </div>
  )
}
