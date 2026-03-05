'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Customer, CustomerInput } from '@/types'
import EntityForm from '@/components/EntityForm'
import LinkedDocuments from '@/components/LinkedDocuments'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const res = await fetch('/api/customers')
    const data = await res.json()
    setCustomers(data)
  }

  async function handleSave(input: CustomerInput) {
    if (editing) {
      await fetch(`/api/customers/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } else {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    }
    setShowForm(false)
    setEditing(null)
    fetchCustomers()
  }

  async function handleDelete(id: number) {
    if (!confirm('Ta bort denna kund?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    fetchCustomers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Kunder</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Ny kund
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
            <EntityForm
              entity={editing ?? undefined}
              type="customer"
              onSave={(data) => handleSave(data as CustomerInput)}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Namn</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Org.nr</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">E-post</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Stad</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, i) => (
              <motion.tr
                key={customer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer group"
                onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
              >
                <td className="px-4 py-3 text-white font-medium">
                  <span className="mr-2 text-gray-600 group-hover:text-gray-400 transition-colors">
                    {expandedId === customer.id ? '▼' : '▶'}
                  </span>
                  {customer.name}
                </td>
                <td className="px-4 py-3 text-gray-400">{customer.org_number || '-'}</td>
                <td className="px-4 py-3 text-gray-400">{customer.email || '-'}</td>
                <td className="px-4 py-3 text-gray-400">{customer.city || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(customer); setShowForm(false) }}
                    className="text-xs text-gray-400 hover:text-white mr-3"
                  >
                    Redigera
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(customer.id) }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Ta bort
                  </button>
                </td>
              </motion.tr>
            )).flatMap((row, i) => {
              const customer = customers[i]
              const items = [row]
              if (expandedId === customer.id) {
                items.push(
                  <tr key={`docs-${customer.id}`}>
                    <td colSpan={5} className="px-4 pb-4 bg-gray-900/50">
                      <LinkedDocuments filterParam="customer_id" filterId={customer.id} />
                    </td>
                  </tr>
                )
              }
              return items
            })}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="text-center text-gray-500 py-8">Inga kunder ännu</p>
        )}
      </div>
    </div>
  )
}
