'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import type { Category } from '@/types'
import { getCategories, invalidateCategories, addToCache } from '@/lib/categories-cache'

const EmojiMartPicker = dynamic(() => import('@emoji-mart/react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-[352px] h-[435px] bg-gray-900 rounded-xl animate-pulse" />,
})

interface CategoryPickerProps {
  value: number | null
  onChange: (categoryId: number | null) => void
  size?: 'sm' | 'md'
}

export default function CategoryPicker({ value, onChange, size = 'sm' }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false })

  function loadCategories() {
    getCategories().then(setCategories)
  }

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { if (open) loadCategories() }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      // Check if click is inside the trigger button or any portal dropdown
      if (ref.current?.contains(target)) return
      const portals = document.querySelectorAll('[data-category-picker-portal]')
      for (const portal of portals) {
        if (portal.contains(target)) return
      }
      setOpen(false)
      setCreating(false)
      setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = categories.find(c => c.id === value)
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() || null }),
    })
    const json = await res.json()
    const created = json.data ?? json
    addToCache(created)
    invalidateCategories()
    setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    onChange(created.id)
    setNewName('')
    setNewEmoji('')
    setCreating(false)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const openUp = spaceBelow < 350
            setDropdownPos({
              top: openUp ? rect.top : rect.bottom + 4,
              left: rect.left,
              openUp,
            })
          }
          setOpen(!open)
        }}
        className={`${textSize} px-2.5 py-1 rounded-full transition-all ${
          selected
            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25'
            : 'border border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400'
        }`}
      >
        {selected ? (
          <>{selected.emoji && <span className="mr-1">{selected.emoji}</span>}{selected.name}</>
        ) : (
          '+ Kategori'
        )}
      </button>

      {open && createPortal(
        <div
          data-category-picker-portal
          className="fixed z-[9998] w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden"
          style={{
            left: dropdownPos.left,
            ...(dropdownPos.openUp
              ? { bottom: window.innerHeight - dropdownPos.top + 4 }
              : { top: dropdownPos.top }),
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {value && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-800 transition-colors"
            >
              Ta bort kategori
            </button>
          )}
          <div className="max-h-48 overflow-y-auto">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { onChange(cat.id); setOpen(false) }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors ${
                  cat.id === value ? 'text-purple-400 bg-gray-800/50' : 'text-gray-300'
                }`}
              >
                {cat.emoji && <span className="mr-2">{cat.emoji}</span>}
                {cat.name}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-800">
            {creating ? (
              <div className="p-2 space-y-2">
                <div className="flex gap-1 items-center">
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-9 h-9 flex items-center justify-center bg-gray-800 border border-gray-700 rounded text-lg hover:border-gray-600 transition-colors shrink-0"
                  >
                    {newEmoji || <span className="text-gray-600 text-sm">+</span>}
                  </button>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Kategorinamn"
                    className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-purple-500"
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    autoFocus
                  />
                </div>
                {showEmojiPicker && createPortal(
                  <div
                    data-category-picker-portal
                    className="fixed z-[9999]"
                    style={{
                      top: emojiButtonRef.current
                        ? Math.min(
                            emojiButtonRef.current.getBoundingClientRect().bottom + 4,
                            window.innerHeight - 450
                          )
                        : 0,
                      left: emojiButtonRef.current
                        ? Math.max(0, emojiButtonRef.current.getBoundingClientRect().left - 352)
                        : 0,
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <EmojiMartPicker
                      data={async () => {
                        const mod = await import('@emoji-mart/data')
                        return mod.default
                      }}
                      onEmojiSelect={(emoji: { native: string }) => {
                        setNewEmoji(emoji.native)
                        setShowEmojiPicker(false)
                      }}
                      theme="dark"
                      previewPosition="none"
                      skinTonePosition="search"
                      set="native"
                    />
                  </div>,
                  document.body
                )}
                <div className="flex gap-1">
                  <button
                    onClick={handleCreate}
                    className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-500 transition-colors"
                  >
                    Skapa
                  </button>
                  <button
                    onClick={() => { setCreating(false); setShowEmojiPicker(false); setNewName(''); setNewEmoji('') }}
                    className="px-2 py-1 text-gray-400 hover:text-white text-xs transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full px-3 py-2 text-left text-xs text-purple-400 hover:bg-gray-800 transition-colors"
              >
                + Skapa ny kategori
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
