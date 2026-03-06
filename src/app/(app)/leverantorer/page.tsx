'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Supplier, SupplierInput, Category } from '@/types'
import EntityForm from '@/components/EntityForm'
import LinkedDocuments from '@/components/LinkedDocuments'
import CategoryPicker from '@/components/CategoryPicker'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    fetchSuppliers()
    fetchCategories()
  }, [])

  async function fetchSuppliers(inactive = showInactive) {
    const res = await fetch(`/api/suppliers${inactive ? '?filter=inactive' : ''}`)
    const json = await res.json()
    setSuppliers(json.data ?? json)
  }

  async function fetchCategories() {
    const res = await fetch('/api/categories')
    const json = await res.json()
    setCategories(json.data ?? json)
  }

  async function handleSave(input: SupplierInput) {
    if (editing) {
      await fetch(`/api/suppliers/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } else {
      await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    }
    setShowForm(false)
    setEditing(null)
    fetchSuppliers()
  }

  async function handleToggleActive(supplier: Supplier) {
    await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: supplier.name, is_active: !supplier.is_active }),
    })
    fetchSuppliers()
  }

  async function handleDelete(id: number) {
    if (!confirm('Ta bort denna leverantör?')) return
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    fetchSuppliers()
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white">Leverantörer</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const next = !showInactive
              setShowInactive(next)
              fetchSuppliers(next)
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showInactive
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {showInactive ? 'Dölj inaktiva' : 'Visa inaktiva'}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
          >
            + Ny leverantör
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(showForm || editing) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <EntityForm
              key={editing?.id ?? 'new'}
              entity={editing ?? undefined}
              type="supplier"
              categories={categories}
              onSave={(data) => handleSave(data as SupplierInput)}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile ? (
        <div className="space-y-3">
          {suppliers.map((supplier, i) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`p-4 bg-gray-900 border border-gray-800 rounded-xl ${!supplier.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{supplier.name}</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditing(supplier); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="text-xs text-gray-400"
                  >
                    Redigera
                  </button>
                  <button
                    onClick={() => handleToggleActive(supplier)}
                    className="text-xs text-gray-400"
                  >
                    {supplier.is_active ? 'Inaktivera' : 'Aktivera'}
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="text-xs text-red-400"
                  >
                    Ta bort
                  </button>
                </div>
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {supplier.org_number || ''} {supplier.email || ''}
              </div>
            </motion.div>
          ))}
          {suppliers.length === 0 && (
            <p className="text-center text-gray-500 py-8">Inga leverantörer ännu</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Namn</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Kategori</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Org.nr</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">E-post</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, i) => (
                <motion.tr
                  key={supplier.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer group ${!supplier.is_active ? 'opacity-50' : ''}`}
                  onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    <span className="mr-2 text-gray-600 group-hover:text-gray-400 transition-colors">
                      {expandedId === supplier.id ? '▼' : '▶'}
                    </span>
                    {supplier.name}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <CategoryPicker
                      value={supplier.category_id}
                      onChange={async (categoryId) => {
                        await fetch(`/api/suppliers/${supplier.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: supplier.name, category_id: categoryId }),
                        })
                        fetchSuppliers()
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-400">{supplier.org_number || '-'}</td>
                  <td className="px-4 py-3 text-gray-400">{supplier.email || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(supplier); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="text-xs text-gray-400 hover:text-white mr-3"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(supplier) }}
                      className="text-xs text-gray-400 hover:text-white mr-3"
                    >
                      {supplier.is_active ? 'Inaktivera' : 'Aktivera'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id) }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Ta bort
                    </button>
                  </td>
                </motion.tr>
              )).flatMap((row, i) => {
                const supplier = suppliers[i]
                const items = [row]
                if (expandedId === supplier.id) {
                  items.push(
                    <tr key={`docs-${supplier.id}`}>
                      <td colSpan={5} className="px-4 pb-4 bg-gray-900/50">
                        <LinkedDocuments filterParam="supplier_id" filterId={supplier.id} />
                      </td>
                    </tr>
                  )
                }
                return items
              })}
            </tbody>
          </table>
          {suppliers.length === 0 && (
            <p className="text-center text-gray-500 py-8">Inga leverantörer ännu</p>
          )}
        </div>
      )}
    </div>
  )
}
