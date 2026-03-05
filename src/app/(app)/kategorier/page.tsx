'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, CategoryInput } from '@/types'
import CategoryForm from '@/components/CategoryForm'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const res = await fetch('/api/categories')
    const data = await res.json()
    setCategories(data)
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group"
          >
            <div className="text-3xl mb-2">{cat.emoji || '📁'}</div>
            <h3 className="text-white font-medium">{cat.name}</h3>
            {cat.description && (
              <p className="text-gray-500 text-sm mt-1">{cat.description}</p>
            )}
            <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditing(cat); setShowForm(false) }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Redigera
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Ta bort
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
