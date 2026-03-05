'use client'

import { useState } from 'react'
import type { Category, CategoryInput } from '@/types'
import EmojiPicker from '@/components/EmojiPicker'

interface Props {
  category?: Category
  onSave: (data: CategoryInput) => void
  onCancel: () => void
}

export default function CategoryForm({ category, onSave, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ name, description: description || undefined, emoji: emoji || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Emoji</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Namn</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Beskrivning</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          Spara
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
        >
          Avbryt
        </button>
      </div>
    </form>
  )
}
