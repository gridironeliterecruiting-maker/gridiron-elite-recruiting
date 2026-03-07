'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, Trash2, Upload, Users, Globe, Palette } from 'lucide-react'
/* eslint-disable @next/next/no-img-element */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

interface Member {
  id: string
  email: string
  role: 'coach' | 'player'
  user_id: string | null
}

interface Program {
  id: string
  school_name: string
  mascot: string | null
  city: string | null
  state: string | null
  landing_slug: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  twitter_username: string | null
  hudl_url: string | null
  instagram_username: string | null
  created_at: string
  members: Member[]
}

interface ProgramForm {
  school_name: string
  mascot: string
  city: string
  state: string
  landing_slug: string
  primary_color: string
  accent_color: string
  twitter_username: string
  hudl_url: string
  instagram_username: string
}

const emptyForm: ProgramForm = {
  school_name: '',
  mascot: '',
  city: '',
  state: '',
  landing_slug: '',
  primary_color: '#0047AB',
  accent_color: '#CC0000',
  twitter_username: '',
  hudl_url: '',
  instagram_username: '',
}

export function AdminDashboard() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Program | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ProgramForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'coach' | 'player'>('coach')
  const [addingMember, setAddingMember] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<{ email: string; role: 'coach' | 'player' }[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = creating || editing !== null

  useEffect(() => {
    loadPrograms()
  }, [])

  const loadPrograms = async () => {
    try {
      const res = await fetch('/api/admin/programs')
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch {
      console.error('Failed to load programs')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setLogoPreview(null)
    setPendingLogoFile(null)
    setEditing(null)
    setCreating(true)
    setPendingMembers([])
    setError('')
  }

  const openEdit = (program: Program) => {
    setForm({
      school_name: program.school_name,
      mascot: program.mascot || '',
      city: program.city || '',
      state: program.state || '',
      landing_slug: program.landing_slug || '',
      primary_color: program.primary_color || '#0047AB',
      accent_color: program.accent_color || '#CC0000',
      twitter_username: program.twitter_username || '',
      hudl_url: program.hudl_url || '',
      instagram_username: program.instagram_username || '',
    })
    setLogoPreview(program.logo_url)
    setEditing(program)
    setCreating(false)
    setError('')
  }

  const closeForm = () => {
    setEditing(null)
    setCreating(false)
    setError('')
  }

  // Auto-suggest slug from school name + state
  const suggestSlug = (name: string, state: string) => {
    if (!name) return ''
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return state ? `${slug}-${state.toLowerCase()}` : slug
  }

  const handleFieldChange = (field: keyof ProgramForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-suggest slug when school name or state changes (only if slug is empty or matches old suggestion)
      if (field === 'school_name' || field === 'state') {
        const oldSuggestion = suggestSlug(prev.school_name, prev.state)
        if (!prev.landing_slug || prev.landing_slug === oldSuggestion) {
          next.landing_slug = suggestSlug(
            field === 'school_name' ? value : prev.school_name,
            field === 'state' ? value : prev.state
          )
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!form.school_name.trim()) {
      setError('School name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = editing
        ? `/api/admin/programs/${editing.id}`
        : '/api/admin/programs'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      // If creating, upload pending logo and add pending members
      if (!editing && data.program) {
        if (pendingLogoFile) {
          try {
            await uploadLogoForProgram(data.program.id, pendingLogoFile)
          } catch {
            console.error('Failed to upload logo during creation')
          }
        }
        if (pendingMembers.length > 0) {
          await Promise.all(pendingMembers.map(m =>
            fetch(`/api/admin/programs/${data.program.id}/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(m),
            })
          ))
        }
      }

      await loadPrograms()
      if (!editing && data.program) {
        // Open the newly created program for editing (to add members, logo)
        const refreshed = await fetch(`/api/admin/programs/${data.program.id}`)
        const refreshedData = await refreshed.json()
        openEdit(refreshedData.program)
      } else {
        closeForm()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Delete "${editing.school_name} ${editing.mascot || ''}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/admin/programs/${editing.id}`, { method: 'DELETE' })
      await loadPrograms()
      closeForm()
    } catch {
      setError('Failed to delete program')
    }
  }

  const handleAddMember = async () => {
    if (!newEmail.trim()) return

    // Creating mode — add to local pending list
    if (creating) {
      const email = newEmail.trim().toLowerCase()
      if (pendingMembers.some(m => m.email === email)) {
        setError('This email is already added')
        return
      }
      setPendingMembers(prev => [...prev, { email, role: newRole }])
      setNewEmail('')
      setError('')
      return
    }

    if (!editing) return
    setAddingMember(true)
    try {
      const res = await fetch(`/api/admin/programs/${editing.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setEditing(prev => prev ? {
        ...prev,
        members: [...prev.members, data.member],
      } : null)
      setPrograms(prev => prev.map(p => p.id === editing.id
        ? { ...p, members: [...p.members, data.member] }
        : p
      ))
      setNewEmail('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!editing) return
    try {
      await fetch(`/api/admin/programs/${editing.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      setEditing(prev => prev ? {
        ...prev,
        members: prev.members.filter(m => m.id !== memberId),
      } : null)
      setPrograms(prev => prev.map(p => p.id === editing.id
        ? { ...p, members: p.members.filter(m => m.id !== memberId) }
        : p
      ))
    } catch {
      setError('Failed to remove member')
    }
  }

  const uploadLogoForProgram = async (programId: string, file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    const res = await fetch(`/api/admin/programs/${programId}/logo`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.logo_url as string
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]

    // Creating mode — hold the file locally and show a preview
    if (creating) {
      setPendingLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
      return
    }

    if (!editing) return
    setUploadingLogo(true)
    try {
      const logoUrl = await uploadLogoForProgram(editing.id, file)
      setLogoPreview(logoUrl)
      setEditing(prev => prev ? { ...prev, logo_url: logoUrl } : null)
      setPrograms(prev => prev.map(p => p.id === editing.id
        ? { ...p, logo_url: logoUrl }
        : p
      ))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const activeMembers = creating ? pendingMembers.map(m => ({ ...m, id: `pending-${m.email}`, user_id: null })) : (editing?.members || [])
  const coachMembers = activeMembers.filter(m => m.role === 'coach')
  const playerMembers = activeMembers.filter(m => m.role === 'player')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[#0047AB]">
              Program Administration
            </h1>
            <p className="text-sm text-gray-500">Manage high school programs, members, and branding</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#0047AB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003580]"
          >
            <Plus className="h-4 w-4" />
            New Program
          </button>
        </div>
      </div>

      {/* Program Grid */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <p className="text-center text-gray-500">Loading programs...</p>
        ) : programs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="text-gray-500">No programs yet. Create your first program to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map(program => {
              const coaches = program.members.filter(m => m.role === 'coach')
              const players = program.members.filter(m => m.role === 'player')
              return (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => openEdit(program)}
                  className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-[#0047AB]/30 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-3">
                    {program.logo_url ? (
                      <img
                        src={program.logo_url}
                        alt={program.school_name}
                        className="h-12 w-12 rounded-lg object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white"
                        style={{ backgroundColor: program.primary_color || '#0047AB' }}
                      >
                        {program.school_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold uppercase tracking-tight text-gray-900">
                        {program.school_name} {program.mascot || ''}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {[program.city, program.state].filter(Boolean).join(', ') || 'No location set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{coaches.length} coach{coaches.length !== 1 ? 'es' : ''}</span>
                    <span>{players.length} player{players.length !== 1 ? 's' : ''}</span>
                    {program.landing_slug && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />/{program.landing_slug}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-1">
                    <div className="h-2 w-8 rounded-full" style={{ backgroundColor: program.primary_color }} />
                    <div className="h-2 w-8 rounded-full" style={{ backgroundColor: program.accent_color }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit/Create Overlay */}
      {isOpen && (
        <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-50 duration-200">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={closeForm} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            {/* Overlay Header */}
            <div className="flex items-center gap-4 border-b border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition hover:bg-[#0047AB] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="flex-1 font-display text-lg font-bold uppercase tracking-tight text-gray-900">
                {creating ? 'New Program' : `Edit: ${editing?.school_name} ${editing?.mascot || ''}`}
              </h2>
              {editing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#0047AB] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#003580] disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Create Program' : 'Save Changes'}
              </button>
            </div>

            {/* Overlay Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="High School Name" required>
                    <input
                      type="text"
                      value={form.school_name}
                      onChange={e => handleFieldChange('school_name', e.target.value)}
                      placeholder="e.g. Prairie"
                      className="input"
                    />
                  </Field>
                  <Field label="Mascot">
                    <input
                      type="text"
                      value={form.mascot}
                      onChange={e => handleFieldChange('mascot', e.target.value)}
                      placeholder="e.g. Hawks"
                      className="input"
                    />
                  </Field>
                  <Field label="City">
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => handleFieldChange('city', e.target.value)}
                      placeholder="e.g. Cedar Rapids"
                      className="input"
                    />
                  </Field>
                  <Field label="State">
                    <select
                      value={form.state}
                      onChange={e => handleFieldChange('state', e.target.value)}
                      className="input"
                    >
                      <option value="">Select state</option>
                      {US_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Landing Page URL">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">runwayrecruit.com/</span>
                      <input
                        type="text"
                        value={form.landing_slug}
                        onChange={e => handleFieldChange('landing_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="e.g. prairie-ia"
                        className="input flex-1"
                      />
                    </div>
                  </Field>
                </div>
              </Section>

              {/* Branding */}
              <Section title="Branding" icon={<Palette className="h-4 w-4" />}>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">Program Logo</label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-20 w-20 rounded-lg border border-gray-200 object-contain"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
                        <Upload className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </button>
                      <p className="mt-1 text-xs text-gray-400">
                        Optimal: 500x500px PNG with transparent background
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <ColorField
                    label="Primary / Banner"
                    description="Navbar background, buttons, active states"
                    value={form.primary_color}
                    onChange={v => handleFieldChange('primary_color', v)}
                  />
                  <ColorField
                    label="Secondary / Accents"
                    description="Top stripe, highlights, badges"
                    value={form.accent_color}
                    onChange={v => handleFieldChange('accent_color', v)}
                  />
                </div>
              </Section>

              {/* Social Media */}
              <Section title="Social Media" icon={<Globe className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Twitter / X Username">
                    <div className="flex items-center">
                      <span className="rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@</span>
                      <input
                        type="text"
                        value={form.twitter_username}
                        onChange={e => handleFieldChange('twitter_username', e.target.value.replace('@', ''))}
                        placeholder="username"
                        className="input rounded-l-none"
                      />
                    </div>
                  </Field>
                  <Field label="Instagram Username">
                    <div className="flex items-center">
                      <span className="rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@</span>
                      <input
                        type="text"
                        value={form.instagram_username}
                        onChange={e => handleFieldChange('instagram_username', e.target.value.replace('@', ''))}
                        placeholder="username"
                        className="input rounded-l-none"
                      />
                    </div>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Hudl URL">
                    <input
                      type="url"
                      value={form.hudl_url}
                      onChange={e => handleFieldChange('hudl_url', e.target.value)}
                      placeholder="https://www.hudl.com/..."
                      className="input"
                    />
                  </Field>
                </div>
              </Section>

              {/* Members */}
              <Section title="Team Members" icon={<Users className="h-4 w-4" />}>
                {/* Add Member */}
                <div className="mb-4 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                      placeholder="name@email.com"
                      className="input"
                    />
                  </div>
                  <div className="w-28">
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">Role</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as 'coach' | 'player')}
                      className="input"
                    >
                      <option value="coach">Coach</option>
                      <option value="player">Player</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!newEmail.trim() || addingMember}
                    className="rounded-lg bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003580] disabled:opacity-50"
                  >
                    {addingMember ? '...' : 'Add'}
                  </button>
                </div>

                {/* Coach List */}
                {coachMembers.length > 0 && (
                  <div className="mb-3">
                    <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Coaches</h4>
                    <div className="space-y-1">
                      {coachMembers.map(m => (
                        <MemberRow key={m.id} member={m} onRemove={() => {
                          if (creating) {
                            setPendingMembers(prev => prev.filter(p => `pending-${p.email}` !== m.id))
                          } else {
                            handleRemoveMember(m.id)
                          }
                        }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Player List */}
                {playerMembers.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Players</h4>
                    <div className="space-y-1">
                      {playerMembers.map(m => (
                        <MemberRow key={m.id} member={m} onRemove={() => {
                          if (creating) {
                            setPendingMembers(prev => prev.filter(p => `pending-${p.email}` !== m.id))
                          } else {
                            handleRemoveMember(m.id)
                          }
                        }} />
                      ))}
                    </div>
                  </div>
                )}

                {coachMembers.length === 0 && playerMembers.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    No members yet. Add coach and player emails above.
                  </p>
                )}
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* Shared Tailwind styles for inputs */}
      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #111827;
          transition: border-color 0.15s;
        }
        .input:focus {
          outline: none;
          border-color: #0047AB;
          box-shadow: 0 0 0 1px #0047AB;
        }
        .input::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-tight text-gray-900">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  )
}

function ColorField({ label, description, value, onChange }: { label: string; description?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-semibold text-gray-700">{label}</label>
      {description && <p className="mb-2 text-[11px] text-gray-400">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-gray-300 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input flex-1 font-mono text-xs"
        />
      </div>
    </div>
  )
}

function MemberRow({ member, onRemove }: { member: Member; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-gray-900">{member.email}</span>
      </div>
      {member.user_id && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
          Active
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
