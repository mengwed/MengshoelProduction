'use client'

import { useState, useEffect } from 'react'
import type { FiscalYear } from '@/types'

export default function FiscalYearSelector() {
  const [years, setYears] = useState<FiscalYear[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/fiscal-years')
      .then(r => r.json())
      .then((data: FiscalYear[]) => {
        setYears(data)
        const active = data.find(y => y.is_active)
        if (active) setActiveId(active.id)
      })
  }, [])

  async function handleChange(id: number) {
    setActiveId(id)
    await fetch('/api/fiscal-years', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_id: id }),
    })
    window.location.reload()
  }

  if (years.length === 0) return null

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => handleChange(Number(e.target.value))}
      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      {years.map((y) => (
        <option key={y.id} value={y.id}>{y.year}</option>
      ))}
    </select>
  )
}
