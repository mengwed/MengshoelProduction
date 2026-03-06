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

  const uploadFile = useCallback(async (file: File, force = false) => {
    setResults((prev) => {
      const existing = prev.findIndex(r => r.file === file)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], status: 'uploading', error: undefined }
        return updated
      }
      return [...prev, { file, status: 'uploading' }]
    })

    const formData = new FormData()
    formData.append('file', file)
    if (typeHint) formData.append('typeHint', typeHint)
    if (force) formData.append('force', 'true')

    try {
      let res: Response
      let retries = 0
      while (true) {
        res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })
        if (res.status === 429 && retries < 3) {
          retries++
          await new Promise(r => setTimeout(r, 2000 * retries))
          continue
        }
        break
      }

      const json = await res.json()

      if (res.status === 409) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'duplicate', error: json.error ?? json.message } : r
          )
        )
      } else if (!res.ok) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'error', error: json.error } : r
          )
        )
      } else {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'done', document: json.data ?? json } : r
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
              {r.status === 'duplicate' && (
                <p className="text-yellow-400 text-xs">Filen finns redan importerad</p>
              )}
              {r.status === 'error' && r.error && (
                <p className="text-red-400 text-xs">{r.error}</p>
              )}
              {r.status === 'uploading' && (
                <p className="text-gray-500 text-xs">Analyserar med AI...</p>
              )}
            </div>
            {r.status === 'duplicate' && (
              <button
                onClick={() => uploadFile(r.file, true)}
                className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors shrink-0"
              >
                Importera ändå
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {allDone && results.length > 0 && (() => {
        const succeeded = results.filter(r => r.status === 'done').length
        const failed = results.filter(r => r.status === 'error' || r.status === 'duplicate')
        return (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl space-y-3">
            <p className="text-white text-sm font-medium">
              {succeeded} av {results.length} filer importerades
            </p>
            {failed.length > 0 && (
              <div>
                <p className="text-red-400 text-xs font-medium mb-1">Ej importerade:</p>
                <ul className="space-y-1">
                  {failed.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 truncate mr-2">{r.file.name} — {r.status === 'duplicate' ? 'finns redan' : r.error}</span>
                      {r.status === 'duplicate' && (
                        <button
                          onClick={() => uploadFile(r.file, true)}
                          className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors shrink-0"
                        >
                          Importera ändå
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => setResults([])}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Rensa lista
            </button>
          </div>
        )
      })()}
    </div>
  )
}
