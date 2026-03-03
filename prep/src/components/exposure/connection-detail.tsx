'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Mail, Phone, MapPin, Trash2, MessageSquare, Handshake, Eye, Star } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import type { Connection, ConnectionStatus } from './pipeline'
import { cn } from '@/lib/utils'

interface Interaction {
  id: string
  type: string
  notes: string | null
  occurred_at: string
}

const STATUSES: { value: ConnectionStatus; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'connected', label: 'Connected' },
  { value: 'visited', label: 'Visited' },
  { value: 'committed', label: 'Committed' },
]

const STATUS_CONFIG: Record<ConnectionStatus, { color: string }> = {
  identified: { color: 'bg-gray-100 text-gray-700' },
  contacted: { color: 'bg-yellow-100 text-yellow-800' },
  connected: { color: 'bg-blue-100 text-blue-800' },
  visited: { color: 'bg-purple-100 text-purple-800' },
  committed: { color: 'bg-green-100 text-green-800' },
}

const INTERACTION_TYPES = [
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'call', label: 'Call', icon: <Phone className="w-4 h-4" /> },
  { value: 'meeting', label: 'Meeting', icon: <Handshake className="w-4 h-4" /> },
  { value: 'visit', label: 'Camp/Visit', icon: <Eye className="w-4 h-4" /> },
  { value: 'social', label: 'Social/DM', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'note', label: 'Note', icon: <Star className="w-4 h-4" /> },
]

interface Props {
  connection: Connection
  onBack: () => void
  onUpdate: (conn: Connection) => void
  onDelete: (id: string) => void
}

export function ConnectionDetail({ connection, onBack, onUpdate, onDelete }: Props) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loadingInteractions, setLoadingInteractions] = useState(true)
  const [showLogForm, setShowLogForm] = useState(false)
  const [logType, setLogType] = useState('email')
  const [logNotes, setLogNotes] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [savingLog, setSavingLog] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setLoadingInteractions(true)
    fetch(`/api/connections/${connection.id}/interactions`)
      .then(r => r.json())
      .then(data => { setInteractions(Array.isArray(data) ? data : []); setLoadingInteractions(false) })
      .catch(() => setLoadingInteractions(false))
  }, [connection.id])

  const handleStatusChange = async (status: ConnectionStatus) => {
    setUpdatingStatus(true)
    const res = await fetch(`/api/connections/${connection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    if (res.ok) onUpdate(updated)
    setUpdatingStatus(false)
  }

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingLog(true)
    const res = await fetch(`/api/connections/${connection.id}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: logType,
        notes: logNotes || null,
        occurred_at: new Date(logDate).toISOString(),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setInteractions(prev => [data, ...prev])
      setShowLogForm(false)
      setLogNotes('')
      // Update connection last_contact_at locally
      onUpdate({ ...connection, last_contact_at: data.occurred_at })
    }
    setSavingLog(false)
  }

  const handleDelete = async () => {
    await fetch(`/api/connections/${connection.id}`, { method: 'DELETE' })
    onDelete(connection.id)
  }

  return (
    <div className="p-5 lg:p-6 max-w-2xl">
      {/* Back button (mobile) */}
      <button onClick={onBack} className="lg:hidden flex items-center gap-1 text-sm text-blue-900 font-medium mb-4 hover:underline">
        <ArrowLeft className="w-4 h-4" />
        Back to list
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">{connection.name}</h2>
          {connection.organization && <p className="text-muted-foreground">{connection.organization}</p>}
          {connection.title && <p className="text-sm text-muted-foreground">{connection.title}</p>}
        </div>
        <button onClick={() => setConfirmDelete(true)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Contact info */}
      <div className="flex flex-wrap gap-3 mb-6 text-sm">
        {connection.email && (
          <a href={`mailto:${connection.email}`} className="flex items-center gap-1.5 text-blue-900 hover:underline">
            <Mail className="w-4 h-4" />{connection.email}
          </a>
        )}
        {connection.phone && (
          <a href={`tel:${connection.phone}`} className="flex items-center gap-1.5 text-blue-900 hover:underline">
            <Phone className="w-4 h-4" />{connection.phone}
          </a>
        )}
        {connection.location && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-4 h-4" />{connection.location}
          </span>
        )}
      </div>

      {/* Status selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Pipeline Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              disabled={updatingStatus}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full transition',
                connection.status === s.value
                  ? STATUS_CONFIG[s.value].color + ' ring-2 ring-offset-1 ring-blue-900'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      {connection.notes && (
        <div className="mb-6 rounded-lg bg-muted p-4 text-sm">
          <p className="font-medium mb-1 text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="text-foreground">{connection.notes}</p>
        </div>
      )}

      {/* Interaction log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Touchpoints</p>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="flex items-center gap-1 text-sm text-blue-900 font-medium hover:underline"
          >
            <Plus className="w-4 h-4" />
            Log touchpoint
          </button>
        </div>

        {showLogForm && (
          <form onSubmit={handleLogInteraction} className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {INTERACTION_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setLogType(t.value)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition',
                    logType === t.value ? 'bg-blue-900 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
            <textarea
              value={logNotes}
              onChange={e => setLogNotes(e.target.value)}
              rows={2}
              placeholder="What happened? (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowLogForm(false)} className="flex-1 border border-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={savingLog} className="flex-1 bg-blue-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-800 transition disabled:opacity-50">
                {savingLog ? 'Saving...' : 'Log it'}
              </button>
            </div>
          </form>
        )}

        {loadingInteractions ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No touchpoints logged yet.</p>
        ) : (
          <div className="space-y-2">
            {interactions.map(interaction => {
              const itype = INTERACTION_TYPES.find(t => t.value === interaction.type)
              return (
                <div key={interaction.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="mt-0.5 text-muted-foreground">{itype?.icon ?? <MessageSquare className="w-4 h-4" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold capitalize">{itype?.label ?? interaction.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(interaction.occurred_at), 'MMM d, yyyy')}
                        {' · '}
                        {formatDistanceToNow(new Date(interaction.occurred_at), { addSuffix: true })}
                      </span>
                    </div>
                    {interaction.notes && <p className="text-sm mt-1">{interaction.notes}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <p className="font-bold text-lg mb-2">Delete connection?</p>
            <p className="text-sm text-gray-500 mb-6">This will permanently remove {connection.name} and all their touchpoints.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-gray-300 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
