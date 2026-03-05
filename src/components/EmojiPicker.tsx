'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Picker = dynamic(() => import('@emoji-mart/react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-[352px] h-[435px] bg-gray-900 rounded-xl animate-pulse" />,
})

interface Props {
  value: string
  onChange: (emoji: string) => void
}

export default function EmojiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-14 h-14 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-xl text-3xl hover:border-gray-600 hover:bg-gray-800 transition-all"
      >
        {value || <span className="text-gray-600 text-xl">+</span>}
      </button>

      {open && (
        <div className="absolute top-16 left-0 z-50">
          <Picker
            data={async () => {
              const mod = await import('@emoji-mart/data')
              return mod.default
            }}
            onEmojiSelect={(emoji: { native: string }) => {
              onChange(emoji.native)
              setOpen(false)
            }}
            theme="dark"
            previewPosition="none"
            skinTonePosition="search"
            set="native"
          />
        </div>
      )}
    </div>
  )
}
