'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string | number
  label: string
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export default function CustomSelect({ value, onChange, options, placeholder, className = '' }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({ top: 0, left: 0, width: 0, openUp: false })

  const selected = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropdownHeight = Math.min(options.length * 36 + 8, 280)
      const openUp = spaceBelow < dropdownHeight && rect.top > spaceBelow
      setPos({
        top: openUp ? rect.top : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUp,
      })
    }
    setOpen(!open)
  }

  function handleSelect(optionValue: string | number) {
    onChange(String(optionValue))
    setOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center justify-between text-left px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors hover:border-gray-600 ${className}`}
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected ? selected.label : (placeholder ?? 'Välj...')}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: pos.left,
            width: pos.width,
            ...(pos.openUp
              ? { bottom: window.innerHeight - pos.top + 4 }
              : { top: pos.top }),
          }}
        >
          <div className="max-h-[268px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-gray-700">
            {options.map(option => {
              const isSelected = String(option.value) === String(value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                    isSelected
                      ? 'text-purple-400 bg-purple-500/10'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className={isSelected ? '' : 'ml-6'}>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
