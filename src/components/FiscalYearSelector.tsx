'use client'

import { useState, useEffect } from 'react'
import type { FiscalYear } from '@/types'

export default function FiscalYearSelector() {
  const [years, setYears] = useState<FiscalYear[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [newYear, setNewYear] = useState('')

  useEffect(() => {
    fetchYears()
  }, [])

  function fetchYears() {
    fetch('/api/fiscal-years')
      .then(r => r.json())
      .then((json) => {
        const data: FiscalYear[] = json.data ?? json
        setYears(data)
        const active = data.find(y => y.is_active)
        if (active) setActiveId(active.id)
      })
  }

  async function handleChange(id: number) {
    setActiveId(id)
    await fetch('/api/fiscal-years', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_id: id }),
    })
    window.location.reload()
  }

  async function handleAdd() {
    const year = parseInt(newYear)
    if (!year) return

    await fetch('/api/fiscal-years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    })
    setAdding(false)
    setNewYear('')
    fetchYears()
  }

  if (years.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <select
          value={activeId ?? ''}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.year}</option>
          ))}
        </select>
        <button
          onClick={() => setAdding(!adding)}
          className="px-2 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
          title="Lägg till år"
        >
          +
        </button>
      </div>
      {adding && (
        <div className="flex gap-1">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="2024"
            className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="px-2 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-500 transition-colors"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
