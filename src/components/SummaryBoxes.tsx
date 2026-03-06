'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Box {
  label: string
  value: number
  icon: string
  format?: 'currency' | 'number'
  subtitle?: string
  onClick?: () => void
  active?: boolean
}

interface Props {
  boxes: Box[]
}

function AnimatedNumber({ value, format = 'currency' }: { value: number; format?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 600
    const start = performance.now()
    const startVal = display

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startVal + (value - startVal) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (format === 'number') return <>{Math.round(display)}</>

  return (
    <>
      {new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(display))}
    </>
  )
}

export default function SummaryBoxes({ boxes }: Props) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 ${boxes.length <= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-7'}`}>
      {boxes.map((box, i) => (
        <motion.div
          key={box.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={box.onClick}
          className={`p-4 bg-gray-900 border rounded-xl transition-colors ${
            box.onClick ? 'cursor-pointer hover:border-purple-500/50' : ''
          } ${box.active ? 'border-purple-500 bg-purple-500/5' : 'border-gray-800'}`}
        >
          <div className="text-2xl mb-1">{box.icon}</div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">{box.label}</p>
          <p className="text-white text-xl font-bold mt-1">
            <AnimatedNumber value={box.value} format={box.format} />
          </p>
          {box.subtitle && (
            <p className="text-gray-500 text-[10px] mt-1 leading-tight">{box.subtitle}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}
