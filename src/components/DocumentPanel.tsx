'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Document, DocumentType, DocumentStatus, Customer, Supplier, Category, DocumentAttachment } from '@/types'
import CustomSelect from '@/components/CustomSelect'
import CustomCheckbox from '@/components/CustomCheckbox'

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'outgoing_invoice', label: 'Kundfaktura' },
  { value: 'incoming_invoice', label: 'Leverantörsfaktura' },
  { value: 'payment_received', label: 'Inbetalning' },
  { value: 'credit_card_statement', label: 'Kontoutdrag' },
  { value: 'government_fee', label: 'Myndighetsavgift' },
  { value: 'loan_statement', label: 'Låneavisering' },
  { value: 'receipt', label: 'Kvitto' },
  { value: 'insurance', label: 'Försäkring' },
  { value: 'other', label: 'Övrigt' },
]

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'imported', label: 'Importerad' },
  { value: 'reviewed', label: 'Granskad' },
  { value: 'paid', label: 'Betald' },
]

interface Props {
  document: Document
  onClose: () => void
  onUpdate: () => void
}

export default function DocumentPanel({ document: doc, onClose, onUpdate }: Props) {
  const [type, setType] = useState<DocumentType>(doc.type)
  const [invoiceNumber, setInvoiceNumber] = useState(doc.invoice_number ?? '')
  const [invoiceDate, setInvoiceDate] = useState(doc.invoice_date ?? '')
  const [dueDate, setDueDate] = useState(doc.due_date ?? '')
  const [amount, setAmount] = useState(doc.amount?.toString() ?? '')
  const [vat, setVat] = useState(doc.vat?.toString() ?? '')
  const [vatRate, setVatRate] = useState(doc.vat_rate?.toString() ?? '')
  const [total, setTotal] = useState(doc.total?.toString() ?? '')
  const [status, setStatus] = useState<DocumentStatus>(doc.status)
  const [customerId, setCustomerId] = useState<number | null>(doc.customer_id)
  const [supplierId, setSupplierId] = useState<number | null>(doc.supplier_id)
  const [categoryId, setCategoryId] = useState<number | null>(doc.category_id)
  const [paymentDate, setPaymentDate] = useState(doc.payment_date ?? '')
  const [vatPaid, setVatPaid] = useState(doc.vat_paid ?? false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reparsing, setReparsing] = useState(false)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.data ?? d))
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d.data ?? d))
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.data ?? d))
    fetch(`/api/documents/${doc.id}/attachments`).then(r => r.json()).then(d => setAttachments(d.data ?? []))
    fetch(`/api/documents/${doc.id}/pdf-url`)
      .then(r => r.json())
      .then(d => {
        const url = d.data?.url ?? d.url
        if (url) {
          setPdfUrl(url)
        } else {
          setPdfUrl('error')
        }
      })
      .catch(() => setPdfUrl('error'))
  }, [doc.id])

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/documents/${doc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        amount: amount ? parseFloat(amount) : null,
        vat: vat ? parseFloat(vat) : null,
        vat_rate: vatRate ? parseFloat(vatRate) : null,
        total: total ? parseFloat(total) : null,
        status,
        customer_id: customerId,
        supplier_id: supplierId,
        category_id: categoryId,
        payment_date: paymentDate || null,
        vat_paid: vatPaid,
        ai_needs_review: false,
      }),
    })
    setSaving(false)
    onUpdate()
  }

  async function handleReparse() {
    setReparsing(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/reparse`, { method: 'POST' })
      if (res.ok) {
        onUpdate()
      }
    } finally {
      setReparsing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Ta bort detta dokument?')) return
    await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    onUpdate()
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAttachmentError(null)
    setUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/documents/${doc.id}/attachments`, {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (!res.ok) {
        setAttachmentError(result.error || 'Uppladdning misslyckades')
        return
      }
      setAttachments(prev => [...prev, result.data])
    } catch {
      setAttachmentError('Uppladdning misslyckades')
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function handleAttachmentOpen(attachment: DocumentAttachment) {
    const res = await fetch(`/api/documents/${doc.id}/attachments/${attachment.id}/url`)
    const result = await res.json()
    if (result.data?.url) {
      window.open(result.data.url, '_blank')
    }
  }

  async function handleAttachmentDelete(attachment: DocumentAttachment) {
    if (!confirm(`Ta bort bilagan "${attachment.file_name}"?`)) return
    await fetch(`/api/documents/${doc.id}/attachments/${attachment.id}`, { method: 'DELETE' })
    setAttachments(prev => prev.filter(a => a.id !== attachment.id))
  }

  const inputClass = "w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
  const isOutgoing = type === 'outgoing_invoice'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="absolute inset-0 md:inset-4 md:top-8 bg-gray-950 md:border md:border-gray-800 md:rounded-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-white truncate">{doc.file_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl ml-4 shrink-0">&times;</button>
        </div>

        {/* Body: PDF left, form right */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* PDF viewer */}
          <div className="hidden md:block w-3/5 border-r border-gray-800 bg-gray-900">
            {pdfUrl === 'error' ? (
              <div className="flex items-center justify-center h-full text-red-400">
                Kunde inte ladda PDF
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full" title="Document PDF" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">
                Laddar PDF...
              </div>
            )}
          </div>

          {/* Form */}
          <div className="flex-1 md:w-2/5 overflow-y-auto p-4 md:p-4">
            {/* Mobile PDF button */}
            {pdfUrl && pdfUrl !== 'error' && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-700 transition-colors"
              >
                📄 Visa PDF
              </a>
            )}

            {doc.ai_needs_review && doc.ai_extracted_data && (() => {
              const reasons = (doc.ai_extracted_data as Record<string, unknown>).review_reasons as string[] | undefined
              return (
                <div className="mb-3 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium mb-1">AI behöver granskning</p>
                  {reasons && reasons.length > 0 && (
                    <ul className="text-yellow-400/70 text-xs list-disc list-inside">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Typ</label>
                <CustomSelect
                  value={type}
                  onChange={(v) => setType(v as DocumentType)}
                  options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <CustomSelect
                  value={status}
                  onChange={(v) => setStatus(v as DocumentStatus)}
                  options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fakturanummer</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fakturadatum</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Förfallodag</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Betalningsdatum</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Belopp (exkl moms)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Moms</label>
                <input type="number" step="0.01" value={vat} onChange={(e) => setVat(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Momssats (%)</label>
                <input type="number" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Totalt (inkl moms)</label>
                <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} />
              </div>
              {isOutgoing ? (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Kund</label>
                  <CustomSelect
                    value={customerId ?? ''}
                    onChange={(v) => setCustomerId(v ? Number(v) : null)}
                    options={[{ value: '', label: 'Ingen' }, ...customers.map(c => ({ value: c.id, label: c.name }))]}
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Leverantör</label>
                  <CustomSelect
                    value={supplierId ?? ''}
                    onChange={(v) => setSupplierId(v ? Number(v) : null)}
                    options={[{ value: '', label: 'Ingen' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
                    className="w-full"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Kategori</label>
                <CustomSelect
                  value={categoryId ?? ''}
                  onChange={(v) => setCategoryId(v ? Number(v) : null)}
                  options={[{ value: '', label: 'Ingen' }, ...categories.map(c => ({ value: c.id, label: `${c.emoji ? `${c.emoji} ` : ''}${c.name}` }))]}
                  className="w-full"
                />
              </div>
            </div>

            {isOutgoing && (
              <CustomCheckbox
                checked={vatPaid}
                onChange={setVatPaid}
                label="Har överfört pengar till momskontot. Kom ihåg att ladda upp momsdragningen från banken!"
                className="mb-4"
              />
            )}

            {/* Attachments section */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Bifogade filer</label>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {attachments.map(att => {
                    const isPdf = att.file_type === 'application/pdf'
                    const ext = att.file_name.split('.').pop()?.toUpperCase() || ''
                    return (
                      <div key={att.id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg group">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{ext}</span>
                        <button
                          onClick={() => handleAttachmentOpen(att)}
                          className="flex-1 text-sm text-gray-200 hover:text-white text-left truncate"
                          title={isPdf ? 'Öppna PDF' : 'Ladda ner'}
                        >
                          {att.file_name}
                        </button>
                        <span className="text-xs text-gray-500">{(att.file_size / 1024).toFixed(0)} KB</span>
                        <button
                          onClick={() => handleAttachmentDelete(att)}
                          className="text-gray-400 hover:text-red-400 transition-colors text-sm px-1"
                          title="Ta bort bilaga"
                        >
                          &times;
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {attachments.length < 5 && (
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-700 transition-colors cursor-pointer">
                  {uploadingAttachment ? 'Laddar upp...' : '+ Lägg till bilaga'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAttachment}
                    className="hidden"
                  />
                </label>
              )}
              {attachmentError && (
                <p className="text-red-400 text-xs mt-2">{attachmentError}</p>
              )}
              {attachments.length >= 5 && (
                <p className="text-gray-500 text-xs">Max 5 bilagor per dokument</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Sparar...' : 'Spara'}
              </button>
              <button
                onClick={handleReparse}
                disabled={reparsing}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm disabled:opacity-50"
              >
                {reparsing ? 'Analyserar...' : 'Analysera om'}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
              >
                Ta bort
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
