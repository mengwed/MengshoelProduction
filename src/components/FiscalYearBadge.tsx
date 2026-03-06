'use client'

import { useState, useEffect } from 'react'
import type { FiscalYear } from '@/types'

export default function FiscalYearBadge() {
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/fiscal-years')
      .then(r => r.json())
      .then((json) => {
        const data: FiscalYear[] = json.data ?? json
        const active = data.find(y => y.is_active)
        if (active) setYear(active.year)
      })
  }, [])

  if (!year) return null

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm font-medium">
      <span className="text-xs">📅</span>
      {year}
    </span>
  )
}
