'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { FiscalYear } from '@/types'
import CustomSelect from '@/components/CustomSelect'

export default function FiscalYearSelector() {
  const [years, setYears] = useState<FiscalYear[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [newYear, setNewYear] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchYears()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchYears() {
    const res = await fetch('/api/fiscal-years')
    const json = await res.json()
    const data: FiscalYear[] = json.data ?? json
    setYears(data)

    const urlYear = searchParams.get('year')
    const urlYearEntry = urlYear ? data.find(y => y.year === parseInt(urlYear)) : null

    if (urlYearEntry) {
      // URL has a year param — sync to DB if needed
      const currentActive = data.find(y => y.is_active)
      if (currentActive?.id !== urlYearEntry.id) {
        await fetch('/api/fiscal-years', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year_id: urlYearEntry.id }),
        })
      }
      setActiveId(urlYearEntry.id)
    } else {
      // No year in URL — use active from DB and add to URL
      const active = data.find(y => y.is_active)
      if (active) {
        setActiveId(active.id)
        const params = new URLSearchParams(searchParams.toString())
        params.set('year', String(active.year))
        router.replace(`${pathname}?${params.toString()}`)
      } else {
        const currentYearEntry = data.find(y => y.year === new Date().getFullYear())
        if (currentYearEntry) {
          setActiveId(currentYearEntry.id)
          await fetch('/api/fiscal-years', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year_id: currentYearEntry.id }),
          })
          const params = new URLSearchParams(searchParams.toString())
          params.set('year', String(currentYearEntry.year))
          router.replace(`${pathname}?${params.toString()}`)
        }
      }
    }
  }

  async function handleChange(id: number) {
    setActiveId(id)
    const selectedYear = years.find(y => y.id === id)
    await fetch('/api/fiscal-years', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_id: id }),
    })
    if (selectedYear) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('year', String(selectedYear.year))
      router.push(`${pathname}?${params.toString()}`)
      router.refresh()
    }
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
        <CustomSelect
          value={activeId ?? ''}
          onChange={(v) => handleChange(Number(v))}
          options={years.map(y => ({ value: y.id, label: String(y.year) }))}
          className="flex-1"
        />
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
