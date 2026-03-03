'use client'

import { useState } from 'react'
import { Plus, ChevronRight, Users, School, Tent, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ConnectionDialog } from './connection-dialog'
import { ConnectionDetail } from './connection-detail'
import { cn } from '@/lib/utils'

export type ConnectionType = 'hs_coach' | 'camp' | 'travel_team' | 'other'
export type ConnectionStatus = 'identified' | 'contacted' | 'connected' | 'visited' | 'committed'

export interface Connection {
  id: string
  type: ConnectionType
  name: string
  organization: string | null
  title: string | null
  email: string | null
  phone: string | null
  location: string | null
  notes: string | null
  status: ConnectionStatus
  last_contact_at: string | null
  created_at: string
  connection_interactions: { count: number }[]
}

const TYPE_CONFIG: Record<ConnectionType, { label: string; icon: React.ReactNode; color: string }> = {
  hs_coach: { label: 'HS Coach', icon: <School className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
  camp: { label: 'Camp', icon: <Tent className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
  travel_team: { label: 'Travel Team', icon: <Users className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
  other: { label: 'Other', icon: <ChevronRight className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  identified: { label: 'Identified', color: 'bg-gray-100 text-gray-700' },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  connected: { label: 'Connected', color: 'bg-blue-100 text-blue-800' },
  visited: { label: 'Visited', color: 'bg-purple-100 text-purple-800' },
  committed: { label: 'Committed', color: 'bg-green-100 text-green-800' },
}

const ALL_TYPES: (ConnectionType | 'all')[] = ['all', 'hs_coach', 'camp', 'travel_team', 'other']

interface Props {
  initialConnections: Connection[]
}

export function ExposurePipeline({ initialConnections }: Props) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<ConnectionType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ConnectionStatus | 'all'>('all')

  const filtered = connections.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    return true
  })

  const selectedConnection = connections.find(c => c.id === selectedId) ?? null

  const handleAdd = (conn: Connection) => {
    setConnections(prev => [conn, ...prev])
  }

  const handleUpdate = (updated: Connection) => {
    setConnections(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  const handleDelete = (id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id))
    setSelectedId(null)
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className={cn('flex flex-col border-r border-border', selectedId ? 'hidden lg:flex w-80' : 'flex-1 lg:w-96 lg:flex-none')}>
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Exposure Pipeline</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{connections.length} connection{connections.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {ALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-full transition',
                  filterType === t
                    ? 'bg-blue-900 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {t === 'all' ? 'All types' : TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="font-medium">No connections yet</p>
              <p className="text-sm mt-1">Add HS coaches, camps, or travel teams to start building your exposure pipeline.</p>
            </div>
          ) : (
            filtered.map(conn => {
              const type = TYPE_CONFIG[conn.type]
              const status = STATUS_CONFIG[conn.status]
              const interactionCount = conn.connection_interactions?.[0]?.count ?? 0

              return (
                <button
                  key={conn.id}
                  onClick={() => setSelectedId(conn.id)}
                  className={cn(
                    'w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors',
                    selectedId === conn.id && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', type.color)}>
                          {type.icon}
                          {type.label}
                        </span>
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', status.color)}>
                          {status.label}
                        </span>
                      </div>
                      <p className="font-semibold text-sm truncate">{conn.name}</p>
                      {conn.organization && (
                        <p className="text-xs text-muted-foreground truncate">{conn.organization}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {interactionCount > 0 && <span>{interactionCount} touchpoint{interactionCount !== 1 ? 's' : ''}</span>}
                    {conn.last_contact_at && (
                      <span>Last contact {formatDistanceToNow(new Date(conn.last_contact_at), { addSuffix: true })}</span>
                    )}
                    {!conn.last_contact_at && <span>No contact yet</span>}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && selectedConnection && (
        <div className="flex-1 overflow-y-auto">
          <ConnectionDetail
            connection={selectedConnection}
            onBack={() => setSelectedId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      )}

      {!selectedId && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select a connection</p>
            <p className="text-sm mt-1">Click any connection to see details and interactions</p>
          </div>
        </div>
      )}

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleAdd}
      />
    </div>
  )
}
