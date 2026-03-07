'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, CategoryInput } from '@/types'
import CategoryForm from '@/components/CategoryForm'
import LinkedDocuments from '@/components/LinkedDocuments'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const res = await fetch('/api/categories')
    const json = await res.json()
    setCategories(json.data ?? json)
  }

  async function handleSave(input: CategoryInput) {
    if (editing) {
      await fetch(`/api/categories/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } else {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    }
    setShowForm(false)
    setEditing(null)
    fetchCategories()
  }

  async function handleDelete(id: number) {
    if (!confirm('Ta bort denna kategori?')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    fetchCategories()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Kategorier</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Ny kategori
        </button>
      </div>

      <AnimatePresence>
        {(showForm || editing) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <CategoryForm
              category={editing ?? undefined}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i < 20 ? i * 0.03 : 0 }}
            className={`p-4 bg-gray-900 border rounded-xl transition-colors cursor-pointer group ${
              expandedId === cat.id ? 'border-purple-500/50 col-span-full' : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{cat.emoji || '📁'}</div>
                <div>
                  <h3 className="text-white font-medium">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-gray-500 text-sm">{cat.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(cat); setShowForm(false) }}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Redigera
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(cat.id) }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Ta bort
                </button>
              </div>
            </div>

            {expandedId === cat.id && (
              <div onClick={(e) => e.stopPropagation()}>
                <LinkedDocuments filterParam="category_id" filterId={cat.id} />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
