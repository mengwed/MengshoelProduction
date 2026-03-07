'use client'

import { useState, useEffect } from 'react'
import type { CompanySettings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => setSettings(json.data ?? json))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!settings) return

    setSaving(true)
    setSaved(false)

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: settings.company_name,
        organization_type: settings.organization_type,
        owner_name: settings.owner_name,
        industry: settings.industry,
        notes: settings.notes,
        show_reparse_button: settings.show_reparse_button,
      }),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) return <div className="text-gray-400">Laddar...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Inställningar</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Företagsnamn</label>
          <input
            type="text"
            value={settings.company_name}
            onChange={e => setSettings({ ...settings, company_name: e.target.value })}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Organisationstyp</label>
          <select
            value={settings.organization_type}
            onChange={e => setSettings({ ...settings, organization_type: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="enskild firma">Enskild firma</option>
            <option value="aktiebolag">Aktiebolag</option>
            <option value="handelsbolag">Handelsbolag</option>
            <option value="ekonomisk förening">Ekonomisk förening</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Ägare/kontaktperson</label>
          <input
            type="text"
            value={settings.owner_name || ''}
            onChange={e => setSettings({ ...settings, owner_name: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Bransch</label>
          <input
            type="text"
            value={settings.industry || ''}
            onChange={e => setSettings({ ...settings, industry: e.target.value || null })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Anteckningar</label>
          <textarea
            value={settings.notes || ''}
            onChange={e => setSettings({ ...settings, notes: e.target.value || null })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>

        <div className="border-t border-gray-700 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300">Visa &quot;Analysera om alla&quot;-knappen</span>
              <p className="text-xs text-gray-500 mt-0.5">Visar knappen f&ouml;r att analysera om alla dokument med AI</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.show_reparse_button}
              onClick={() => setSettings({ ...settings, show_reparse_button: !settings.show_reparse_button })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                settings.show_reparse_button ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.show_reparse_button ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          {saved && <span className="text-green-400 text-sm">Sparat!</span>}
        </div>
      </form>
    </div>
  )
}
