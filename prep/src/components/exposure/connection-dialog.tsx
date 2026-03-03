'use client'

import { useState } from 'react'
import type { Connection, ConnectionType, ConnectionStatus } from './pipeline'

const TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'hs_coach', label: 'High School Coach' },
  { value: 'camp', label: 'Camp / Showcase' },
  { value: 'travel_team', label: 'Travel Team' },
  { value: 'other', label: 'Other' },
]

const STATUSES: { value: ConnectionStatus; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'connected', label: 'Connected' },
  { value: 'visited', label: 'Visited' },
  { value: 'committed', label: 'Committed' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSave: (conn: Connection) => void
  initial?: Partial<Connection>
}

export function ConnectionDialog({ open, onClose, onSave, initial }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: initial?.type ?? 'hs_coach' as ConnectionType,
    name: initial?.name ?? '',
    organization: initial?.organization ?? '',
    title: initial?.title ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    location: initial?.location ?? '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'identified' as ConnectionStatus,
  })

  if (!open) return null

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError('Name is required'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        organization: form.organization || null,
        title: form.title || null,
        email: form.email || null,
        phone: form.phone || null,
        location: form.location || null,
        notes: form.notes || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    onSave({ ...data, connection_interactions: [] })
    onClose()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-lg">Add Connection</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track a coach, camp, or travel team</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={set('type')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={set('status')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={set('name')} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Coach Smith / Camp Name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School / Organization</label>
            <input type="text" value={form.organization} onChange={set('organization')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Lincoln High School" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title / Role</label>
            <input type="text" value={form.title} onChange={set('title')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Head Football Coach" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={form.location} onChange={set('location')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="City, State" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" placeholder="Any context about this connection..." />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
