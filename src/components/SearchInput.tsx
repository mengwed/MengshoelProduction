'use client'

import { useState, useEffect } from 'react'

interface SearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export default function SearchInput({ onSearch, placeholder = 'Sök...' }: SearchInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), 300)
    return () => clearTimeout(timer)
  }, [value, onSearch])

  return (
    <div className="relative w-64">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-8 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-purple-500 text-white text-xs hover:bg-purple-400 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}
