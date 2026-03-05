'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { logout } from '@/app/login/actions'
import FiscalYearSelector from '@/components/FiscalYearSelector'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/kundfakturor', label: 'Kundfakturor', icon: '💰' },
  { href: '/leverantorsfakturor', label: 'Leverantörsfakturor', icon: '📦' },
  { href: '/ovriga-dokument', label: 'Övriga dokument', icon: '📋' },
  { href: '/bankavstamning', label: 'Bankavstämning', icon: '🏦' },
  { href: '/kunder', label: 'Kunder', icon: '👥' },
  { href: '/leverantorer', label: 'Leverantörer', icon: '🏢' },
  { href: '/kategorier', label: 'Kategorier', icon: '🏷️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 h-screen bg-gray-950 border-r border-gray-800 flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">AJ</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-gray-800/50 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-2">
        <label className="block text-xs text-gray-500 mb-1 px-1">Räkenskapsår</label>
        <FiscalYearSelector />
      </div>

      <div className="p-3 border-t border-gray-800">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
          >
            <span>👋</span>
            <span>Logga ut</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
