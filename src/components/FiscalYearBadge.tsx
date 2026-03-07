'use client'

import { useSearchParams } from 'next/navigation'

export default function FiscalYearBadge() {
  const searchParams = useSearchParams()
  const year = searchParams.get('year')

  if (!year) return null

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm font-medium">
      <span className="text-xs">📅</span>
      {year}
    </span>
  )
}
