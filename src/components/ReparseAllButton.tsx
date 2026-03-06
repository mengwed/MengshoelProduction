'use client'

import { useState } from 'react'

interface Props {
  onComplete: () => void
}

export default function ReparseAllButton({ onComplete }: Props) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ reparsed: number; total: number } | null>(null)

  async function handleClick() {
    if (!confirm('Analysera om alla dokument med saknad data? Detta kan ta några minuter.')) return

    setRunning(true)
    setProgress(null)

    try {
      const res = await fetch('/api/documents/reparse-all', { method: 'POST' })
      const json = await res.json()
      const data = json.data ?? json

      setProgress({ reparsed: data.reparsed ?? 0, total: data.total ?? 0 })
      onComplete()
    } catch {
      setProgress({ reparsed: 0, total: 0 })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={running}
        className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm disabled:opacity-50"
      >
        {running ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Analyserar om...
          </span>
        ) : (
          'Analysera om alla'
        )}
      </button>
      {progress && !running && (
        <span className="text-sm text-gray-400">
          {progress.reparsed}/{progress.total} analyserade
        </span>
      )}
    </div>
  )
}
