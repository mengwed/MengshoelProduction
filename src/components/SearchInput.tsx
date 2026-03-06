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
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none w-64"
    />
  )
}
