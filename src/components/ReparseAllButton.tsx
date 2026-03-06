'use client'

import { useState } from 'react'

interface Props {
  onComplete: () => void
}

export default function ReparseAllButton({ onComplete }: Props) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ reparsed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm('Analysera om alla dokument med saknad data? Detta kan ta några minuter.')) return

    setRunning(true)
    setProgress(null)
    setError(null)

    try {
      const res = await fetch('/api/documents/reparse-all', { method: 'POST' })
      const json = await res.json()
      const data = json.data ?? json

      if (data.error === 'invalid_api_key') {
        setError('api_key')
        return
      }

      if (!res.ok) {
        setError('generic')
        return
      }

      setProgress({ reparsed: data.reparsed ?? 0, total: data.total ?? 0 })

      // Check if all failed (likely API key issue)
      if (data.total > 0 && data.reparsed === 0) {
        const firstError = data.results?.[0]?.error || ''
        if (firstError.includes('authentication') || firstError.includes('invalid') || firstError.includes('401')) {
          setError('api_key')
          return
        }
        setError('all_failed')
        return
      }

      onComplete()
    } catch {
      setError('generic')
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
      {progress && !running && !error && (
        <span className="text-sm text-gray-400">
          {progress.reparsed}/{progress.total} analyserade
        </span>
      )}
      {error === 'api_key' && (
        <span className="text-sm text-red-400">
          AI-nyckeln fungerar inte.{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-red-300"
          >
            Uppdatera API-nyckeln
          </a>
        </span>
      )}
      {error === 'all_failed' && (
        <span className="text-sm text-red-400">
          Alla analyser misslyckades. Kontrollera loggar eller prova igen.
        </span>
      )}
      {error === 'generic' && (
        <span className="text-sm text-red-400">
          Något gick fel. Prova igen.
        </span>
      )}
    </div>
  )
}
