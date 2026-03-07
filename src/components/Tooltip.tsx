'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'

interface Props {
  text: string
  children: ReactNode
  position?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, position = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setVisible(true), 80)
  }, [])

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }, [])

  const isTop = position === 'top'

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none
            px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
            bg-gray-800 text-gray-100 border border-gray-700/80
            shadow-[0_4px_20px_rgba(0,0,0,0.5)]
            animate-[tooltipIn_120ms_ease-out_forwards]
            ${isTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45
              bg-gray-800 border-gray-700/80
              ${isTop ? 'top-full -mt-1 border-r border-b' : 'bottom-full -mb-1 border-l border-t'}`}
          />
        </span>
      )}
    </span>
  )
}
