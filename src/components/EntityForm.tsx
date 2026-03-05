'use client'

import { useState } from 'react'
import type { Customer, Supplier, CustomerInput, SupplierInput, Category } from '@/types'

interface Props {
  entity?: Customer | Supplier
  type: 'customer' | 'supplier'
  categories?: Category[]
  onSave: (data: CustomerInput | SupplierInput) => void
  onCancel: () => void
}

export default function EntityForm({ entity, type, categories, onSave, onCancel }: Props) {
  const [name, setName] = useState(entity?.name ?? '')
  const [orgNumber, setOrgNumber] = useState(entity?.org_number ?? '')
  const [address, setAddress] = useState(entity?.address ?? '')
  const [postalCode, setPostalCode] = useState(entity?.postal_code ?? '')
  const [city, setCity] = useState(entity?.city ?? '')
  const [email, setEmail] = useState(entity?.email ?? '')
  const [phone, setPhone] = useState(entity?.phone ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(
    (entity && 'category_id' in entity ? entity.category_id : null)
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const base: CustomerInput = {
      name,
      org_number: orgNumber || undefined,
      address: address || undefined,
      postal_code: postalCode || undefined,
      city: city || undefined,
      email: email || undefined,
      phone: phone || undefined,
    }
    if (type === 'supplier') {
      onSave({ ...base, category_id: categoryId } as SupplierInput)
    } else {
      onSave(base)
    }
  }

  const inputClass = "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Namn</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Org.nummer</label>
          <input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">E-post</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Adress</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Postnummer</label>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Stad</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        {type === 'supplier' && categories && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Kategori</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">Ingen kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
