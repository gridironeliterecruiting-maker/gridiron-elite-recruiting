'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, X, Trash2, Upload, Users, Globe, Palette, Copy, Check, Tag, LayoutDashboard, Building2, UserCheck, Send, Target, Instagram, Youtube, ChevronDown, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TwitterProfileCard } from '@/components/hub/twitter-profile-card'
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
  profile: {
    first_name: string | null
    last_name: string | null
    username: string | null
    workspace_email: string | null
  } | null
}

interface Program {
  id: string
  school_name: string
  mascot: string | null
  city: string | null
  state: string | null
  landing_slug: string | null
  logo_url: string | null
  background_image_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  twitter_username: string | null
  hudl_url: string | null
  instagram_username: string | null
  coach_invite_code: string | null
  player_invite_code: string | null
  max_coaches: number
  max_players: number
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

interface PromoCode {
  id: string
  code: string
  percent_off: number | null
  amount_off: number | null
  currency: string | null
  duration: string
  duration_in_months: number | null
  max_redemptions: number | null
  times_redeemed: number
  valid: boolean
  created: number
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

type Tab = 'dashboard' | 'teams' | 'promos'

export function AdminDashboard({ twitterHandle, hasTwitterToken }: { twitterHandle: string | null; hasTwitterToken: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [adminName, setAdminName] = useState<{ first: string; last: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.first_name) setAdminName({ first: data.first_name, last: data.last_name || '' })
        })
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    document.cookie = 'site_session=;path=/;max-age=0'
    router.push('/admin')
  }

  const initials = adminName ? `${adminName.first[0]}${adminName.last[0] || ''}`.toUpperCase() : 'PA'
  const fullName = adminName ? `${adminName.first} ${adminName.last}`.trim() : 'Paul Admin'

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav Bar — exact mirror of main site NavBar */}
      <header className="sticky top-0 z-50">
        {/* Red accent stripe */}
        <div className="h-1 bg-accent" />

        <nav className="relative bg-primary shadow-lg">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <div className="relative -mb-5 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                  <div className="relative h-[72px] w-[72px] lg:h-[80px] lg:w-[80px]">
                    <Image src="/logo.png" alt="Runway Recruit logo" fill className="object-contain" priority />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-primary-foreground">
                    Runway Recruit
                  </h1>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                    Admin Portal
                  </p>
                </div>
              </div>

              {/* Tab Nav — centered, matches main nav item style exactly */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
                <TabButton icon={LayoutDashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
                  Dashboard
                </TabButton>
                <TabButton icon={Users} active={activeTab === 'teams'} onClick={() => setActiveTab('teams')}>
                  Teams
                </TabButton>
                <TabButton icon={Tag} active={activeTab === 'promos'} onClick={() => setActiveTab('promos')}>
                  Promos
                </TabButton>
              </div>

              {/* User avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <Avatar className="h-8 w-8 ring-2 ring-accent">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left lg:block">
                      <p className="text-sm font-semibold leading-tight text-primary-foreground">{fullName}</p>
                      <p className="text-[11px] text-primary-foreground/50">Administrator</p>
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-primary-foreground/50 lg:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </nav>
      </header>

      {/* Tab Content — single main wrapper matches app layout exactly */}
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        {activeTab === 'dashboard' && <DashboardTab twitterHandle={twitterHandle} hasTwitterToken={hasTwitterToken} />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'promos' && <PromosTab />}
      </main>

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
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 1px hsl(var(--primary));
        }
        .input::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-primary-foreground/15 text-primary-foreground shadow-inner ring-1 ring-primary-foreground/20'
          : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

// ─── DASHBOARD TAB ─────────────────────────────────────────────────────────

interface DashboardStats {
  recruits: number
  programs: number
  coaches: number
  campaigns: number
  offers: number
}

interface TwitterProfile {
  id: string
  username: string
  name: string
  description: string
  profileImageUrl: string | null
  followersCount: number
  followingCount: number
  tweetCount: number
  isProtected: boolean
  pinnedTweet: { text: string; hasMedia: boolean; createdAt: string } | null
  lastTweetAt: string | null
}

function DashboardTab({ twitterHandle, hasTwitterToken }: { twitterHandle: string | null; hasTwitterToken: boolean }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfile | null>(null)
  const [twitterLoading, setTwitterLoading] = useState(hasTwitterToken)
  const [twitterLoadFailed, setTwitterLoadFailed] = useState(false)
  const [effectiveHandle, setEffectiveHandle] = useState<string | null>(twitterHandle)

  const fetchTwitterProfile = useCallback(async () => {
    setTwitterLoading(true)
    setTwitterLoadFailed(false)
    let lastData: { connected?: boolean; profile?: unknown } | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/twitter/profile')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        lastData = data
        if (data.connected === false) {
          setEffectiveHandle(null)
          setTwitterLoading(false)
          return
        }
        if (data.profile) {
          setTwitterProfile(data.profile)
          setTwitterLoading(false)
          return
        }
      } catch {
        if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
      }
    }
    setTwitterLoading(false)
    if (!lastData?.profile) setTwitterLoadFailed(true)
  }, [])

  useEffect(() => {
    if (!hasTwitterToken) return
    fetchTwitterProfile()
  }, [hasTwitterToken, fetchTwitterProfile])

  const handleConnectTwitter = () => {
    window.location.href = `/api/twitter/authorize?returnTo=${encodeURIComponent('/admin')}`
  }

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const metricCards = [
    { label: 'Recruits', value: stats?.recruits ?? 0, icon: UserCheck, color: 'primary' as const },
    { label: 'Programs', value: stats?.programs ?? 0, icon: Building2, color: 'primary' as const },
    { label: 'Coaches', value: stats?.coaches ?? 0, icon: Users, color: 'primary' as const },
    { label: 'Campaigns', value: stats?.campaigns ?? 0, icon: Send, color: 'accent' as const },
    { label: 'Offers', value: stats?.offers ?? 0, icon: Target, color: 'accent' as const },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <LayoutDashboard className="h-3.5 w-3.5 text-accent" />
          PLATFORM OVERVIEW AND CONNECTIONS.
        </p>
      </div>

      {/* Social connections — X large left, 3 stacked right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* X profile card — same as hub */}
        <div className="lg:col-span-9">
          {twitterLoading ? (
            <TwitterProfileSkeleton />
          ) : (
            <TwitterProfileCard
              profile={twitterProfile}
              handle={effectiveHandle}
              loadFailed={twitterLoadFailed}
              onConnect={handleConnectTwitter}
            />
          )}
        </div>

        {/* 3 stacked social placeholders */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {[
            { label: 'Instagram', icon: Instagram, color: 'from-pink-500/10 to-purple-500/10', iconColor: 'text-pink-500', ring: 'ring-pink-500/20', bg: 'bg-pink-500/10' },
            { label: 'Facebook', icon: Globe, color: 'from-blue-600/10 to-blue-500/10', iconColor: 'text-blue-600', ring: 'ring-blue-500/20', bg: 'bg-blue-500/10' },
            { label: 'YouTube', icon: Youtube, color: 'from-red-500/10 to-red-600/10', iconColor: 'text-red-500', ring: 'ring-red-500/20', bg: 'bg-red-500/10' },
          ].map(({ label, icon: Icon, color, iconColor, ring, bg }) => (
            <div key={label} className="flex-1 overflow-hidden rounded-xl border bg-card">
              <div className={`flex h-full items-center gap-4 bg-gradient-to-br ${color} px-5 py-4`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} ring-2 ${ring}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Connect {label}</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {metricCards.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${stat.color === 'accent' ? 'bg-accent' : 'bg-primary'}`} />
            <div className="p-5 pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">
                    {loading ? '—' : stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.color === 'accent' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TEAMS TAB ─────────────────────────────────────────────────────────────

function TeamsTab() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Program | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ProgramForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [uploadingBgImage, setUploadingBgImage] = useState(false)
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(null)
  const [pendingBgImageFile, setPendingBgImageFile] = useState<File | null>(null)
  const bgImageInputRef = useRef<HTMLInputElement>(null)
  const [maxCoaches, setMaxCoaches] = useState(5)
  const [maxPlayers, setMaxPlayers] = useState(30)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
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
    setBgImagePreview(null)
    setPendingBgImageFile(null)
    setEditing(null)
    setCreating(true)
    setMaxCoaches(5)
    setMaxPlayers(30)
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
    setBgImagePreview(program.background_image_url || null)
    setPendingBgImageFile(null)
    setMaxCoaches(program.max_coaches ?? 5)
    setMaxPlayers(program.max_players ?? 30)
    setEditing(program)
    setCreating(false)
    setError('')
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const closeForm = () => {
    setEditing(null)
    setCreating(false)
    setError('')
  }

  const suggestSlug = (name: string, state: string) => {
    if (!name) return ''
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return state ? `${slug}-${state.toLowerCase()}` : slug
  }

  const handleFieldChange = (field: keyof ProgramForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
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
      const url = editing ? `/api/admin/programs/${editing.id}` : '/api/admin/programs'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, max_coaches: maxCoaches, max_players: maxPlayers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      if (!editing && data.program) {
        if (pendingLogoFile) {
          try { await uploadLogoForProgram(data.program.id, pendingLogoFile) } catch {}
        }
        if (pendingBgImageFile) {
          try {
            const formData = new FormData()
            formData.append('background_image', pendingBgImageFile)
            await fetch(`/api/admin/programs/${data.program.id}/logo`, { method: 'POST', body: formData })
          } catch {}
        }
      }

      await loadPrograms()
      if (!editing && data.program) {
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

  const handleRemoveMember = async (memberId: string) => {
    if (!editing) return
    try {
      await fetch(`/api/admin/programs/${editing.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      setEditing(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== memberId) } : null)
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
    const res = await fetch(`/api/admin/programs/${programId}/logo`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.logo_url as string
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
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
      setPrograms(prev => prev.map(p => p.id === editing.id ? { ...p, logo_url: logoUrl } : p))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    if (creating) {
      setPendingBgImageFile(file)
      setBgImagePreview(URL.createObjectURL(file))
      return
    }
    if (!editing) return
    setUploadingBgImage(true)
    try {
      const formData = new FormData()
      formData.append('background_image', file)
      const res = await fetch(`/api/admin/programs/${editing.id}/logo`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBgImagePreview(data.background_image_url)
      setEditing(prev => prev ? { ...prev, background_image_url: data.background_image_url } : null)
      setPrograms(prev => prev.map(p => p.id === editing.id ? { ...p, background_image_url: data.background_image_url } : p))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload background image')
    } finally {
      setUploadingBgImage(false)
    }
  }

  const activeMembers = editing?.members || []
  const coachMembers = activeMembers.filter(m => m.role === 'coach')
  const playerMembers = activeMembers.filter(m => m.role === 'player')

  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Team Administration
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-accent" />
            MANAGE TEAMS, MEMBERS, AND BRANDING.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Program
        </button>
      </div>

      {/* Program Grid */}
      <div className="mt-6">
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
                  className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-3">
                    {program.logo_url ? (
                      <img src={program.logo_url} alt={program.school_name} className="h-12 w-12 rounded-lg object-contain" />
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
            <div className="flex items-center gap-4 border-b border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition hover:bg-primary hover:text-primary-foreground"
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
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Create Program' : 'Save Changes'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="High School Name" required>
                    <input type="text" value={form.school_name} onChange={e => handleFieldChange('school_name', e.target.value)} placeholder="e.g. Prairie" className="input" />
                  </Field>
                  <Field label="Mascot">
                    <input type="text" value={form.mascot} onChange={e => handleFieldChange('mascot', e.target.value)} placeholder="e.g. Hawks" className="input" />
                  </Field>
                  <Field label="City">
                    <input type="text" value={form.city} onChange={e => handleFieldChange('city', e.target.value)} placeholder="e.g. Cedar Rapids" className="input" />
                  </Field>
                  <Field label="State">
                    <select value={form.state} onChange={e => handleFieldChange('state', e.target.value)} className="input">
                      <option value="">Select state</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
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

              <Section title="Branding" icon={<Palette className="h-4 w-4" />}>
                <div className="mb-4 grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">Team Logo</label>
                    <div className="flex items-start gap-3">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-lg border border-gray-200 object-contain" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
                          <Upload className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                          {uploadingLogo ? 'Uploading...' : 'Upload'}
                        </button>
                        <p className="mt-1 text-[10px] text-gray-400 leading-tight">500×500px PNG<br />transparent bg</p>
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">Landing Page Background</label>
                    <div className="flex items-start gap-3">
                      {bgImagePreview ? (
                        <img src={bgImagePreview} alt="Background preview" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
                          <Upload className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <button type="button" onClick={() => bgImageInputRef.current?.click()} disabled={uploadingBgImage} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                          {uploadingBgImage ? 'Uploading...' : 'Upload'}
                        </button>
                        <p className="mt-1 text-[10px] text-gray-400 leading-tight">Wide photo · JPG/PNG<br />1920×1080 ideal</p>
                        <input ref={bgImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBgImageUpload} className="hidden" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <ColorField label="Primary / Banner" description="Navbar background, buttons, active states" value={form.primary_color} onChange={v => handleFieldChange('primary_color', v)} />
                  <ColorField label="Secondary / Accents" description="Top stripe, highlights, badges" value={form.accent_color} onChange={v => handleFieldChange('accent_color', v)} />
                </div>
              </Section>

              <Section title="Social Media" icon={<Globe className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Twitter / X Username">
                    <div className="flex items-center">
                      <span className="rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@</span>
                      <input type="text" value={form.twitter_username} onChange={e => handleFieldChange('twitter_username', e.target.value.replace('@', ''))} placeholder="username" className="input rounded-l-none" />
                    </div>
                  </Field>
                  <Field label="Instagram Username">
                    <div className="flex items-center">
                      <span className="rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@</span>
                      <input type="text" value={form.instagram_username} onChange={e => handleFieldChange('instagram_username', e.target.value.replace('@', ''))} placeholder="username" className="input rounded-l-none" />
                    </div>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Hudl URL">
                    <input type="url" value={form.hudl_url} onChange={e => handleFieldChange('hudl_url', e.target.value)} placeholder="https://www.hudl.com/..." className="input" />
                  </Field>
                </div>
              </Section>

              <Section title="Invite Codes" icon={<Users className="h-4 w-4" />}>
                <p className="text-xs text-gray-500 mb-4">
                  Share these codes with coaches and players. They use them to register on the program&apos;s landing page.
                  A code stops working once the seat limit is reached.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Coach Code</p>
                    {editing?.coach_invite_code ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-widest text-primary">{editing.coach_invite_code}</span>
                        <button type="button" onClick={() => copyCode(editing.coach_invite_code!)} className="rounded p-1 text-gray-400 hover:text-primary transition">
                          {copiedCode === editing.coach_invite_code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Generated on save</p>
                    )}
                    <div className="mt-3">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Coaches</label>
                      <input type="number" min={1} max={50} value={maxCoaches} onChange={e => setMaxCoaches(parseInt(e.target.value) || 1)} className="input w-20" />
                      {editing && <p className="text-[10px] text-gray-400 mt-1">{editing.members.filter(m => m.role === 'coach').length} / {maxCoaches} used</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Player Code</p>
                    {editing?.player_invite_code ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-widest text-primary">{editing.player_invite_code}</span>
                        <button type="button" onClick={() => copyCode(editing.player_invite_code!)} className="rounded p-1 text-gray-400 hover:text-primary transition">
                          {copiedCode === editing.player_invite_code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Generated on save</p>
                    )}
                    <div className="mt-3">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Players</label>
                      <input type="number" min={1} max={200} value={maxPlayers} onChange={e => setMaxPlayers(parseInt(e.target.value) || 1)} className="input w-20" />
                      {editing && <p className="text-[10px] text-gray-400 mt-1">{editing.members.filter(m => m.role === 'player').length} / {maxPlayers} used</p>}
                    </div>
                  </div>
                </div>
              </Section>

              {editing && (
                <Section title="Team Members" icon={<Users className="h-4 w-4" />}>
                  <p className="text-xs text-gray-400 mb-4">Members who have registered via the invite code. Removing a member revokes their access and deletes their account.</p>
                  {coachMembers.length > 0 && (
                    <div className="mb-3">
                      <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Coaches ({coachMembers.length}/{editing.max_coaches})</h4>
                      <div className="space-y-1">
                        {coachMembers.map(m => <MemberRow key={m.id} member={m} onRemove={() => handleRemoveMember(m.id)} />)}
                      </div>
                    </div>
                  )}
                  {playerMembers.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Players ({playerMembers.length}/{editing.max_players})</h4>
                      <div className="space-y-1">
                        {playerMembers.map(m => <MemberRow key={m.id} member={m} onRemove={() => handleRemoveMember(m.id)} />)}
                      </div>
                    </div>
                  )}
                  {coachMembers.length === 0 && playerMembers.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">No members have registered yet.</p>
                  )}
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── PROMOS TAB ─────────────────────────────────────────────────────────────

function PromosTab() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // New code form
  const [newCode, setNewCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once')
  const [durationMonths, setDurationMonths] = useState('3')
  const [maxRedemptions, setMaxRedemptions] = useState('')

  useEffect(() => {
    loadCodes()
  }, [])

  const loadCodes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/promo-codes')
      const data = await res.json()
      setCodes(data.codes || [])
    } catch {
      console.error('Failed to load promo codes')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCode.trim()) { setError('Code is required'); return }
    if (!discountValue || parseFloat(discountValue) <= 0) { setError('Discount value must be greater than 0'); return }
    if (discountType === 'percent' && parseFloat(discountValue) > 100) { setError('Percent off cannot exceed 100'); return }
    if (duration === 'repeating' && (!durationMonths || parseInt(durationMonths) < 1)) { setError('Duration months must be at least 1'); return }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          discountType,
          discountValue: parseFloat(discountValue),
          duration,
          durationMonths: duration === 'repeating' ? parseInt(durationMonths) : undefined,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create promo code')
      setSuccess(`Promo code "${data.code.code}" created successfully.`)
      setCreating(false)
      setNewCode('')
      setDiscountValue('')
      setMaxRedemptions('')
      await loadCodes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create promo code')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string, code: string) => {
    if (!confirm(`Deactivate promo code "${code}"? It will no longer be usable.`)) return
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to deactivate code')
        return
      }
      setSuccess(`Promo code "${code}" deactivated.`)
      await loadCodes()
    } catch {
      setError('Failed to deactivate code')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedId(code)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDiscount = (c: PromoCode) => {
    if (c.percent_off) return `${c.percent_off}% off`
    if (c.amount_off) return `$${(c.amount_off / 100).toFixed(0)} off`
    return '—'
  }

  const formatDuration = (c: PromoCode) => {
    if (c.duration === 'once') return 'One-time'
    if (c.duration === 'forever') return 'Forever'
    if (c.duration === 'repeating') return `${c.duration_in_months} month${c.duration_in_months !== 1 ? 's' : ''}`
    return c.duration
  }

  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Promos
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Tag className="h-3.5 w-3.5 text-accent" />
            CREATE AND MANAGE PROMO CODES.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setError(''); setSuccess('') }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Code
        </button>
      </div>

      <div className="mt-6">
        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Create Form */}
        {creating && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-bold uppercase tracking-tight text-gray-900">New Promo Code</h3>
              <button type="button" onClick={() => { setCreating(false); setError('') }} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-gray-700 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Code" required>
                <input
                  type="text"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. SUMMER25"
                  className="input font-mono tracking-widest"
                />
              </Field>
              <Field label="Discount Type">
                <select value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'amount')} className="input">
                  <option value="percent">Percent off (%)</option>
                  <option value="amount">Amount off ($)</option>
                </select>
              </Field>
              <Field label={discountType === 'percent' ? 'Percent Off' : 'Amount Off (USD)'} required>
                <div className="flex items-center">
                  {discountType === 'amount' && <span className="rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">$</span>}
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? 100 : undefined}
                    step={discountType === 'percent' ? 1 : 0.01}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? '25' : '10.00'}
                    className={`input ${discountType === 'amount' ? 'rounded-l-none' : ''}`}
                  />
                  {discountType === 'percent' && <span className="rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">%</span>}
                </div>
              </Field>
              <Field label="Duration">
                <select value={duration} onChange={e => setDuration(e.target.value as 'once' | 'repeating' | 'forever')} className="input">
                  <option value="once">Once (applies once)</option>
                  <option value="repeating">Repeating (N months)</option>
                  <option value="forever">Forever</option>
                </select>
              </Field>
              {duration === 'repeating' && (
                <Field label="Duration (months)" required>
                  <input type="number" min="1" value={durationMonths} onChange={e => setDurationMonths(e.target.value)} className="input" />
                </Field>
              )}
              <Field label="Max Redemptions">
                <input
                  type="number"
                  min="1"
                  value={maxRedemptions}
                  onChange={e => setMaxRedemptions(e.target.value)}
                  placeholder="Unlimited"
                  className="input"
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setCreating(false); setError('') }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Code'}
              </button>
            </div>
          </div>
        )}

        {/* Codes Table */}
        {loading ? (
          <p className="text-center text-gray-500">Loading promo codes...</p>
        ) : codes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
            <Tag className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="text-gray-500">No promo codes yet. Create your first code to offer discounts.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Discount</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Uses</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(c => (
                  <tr key={c.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-wider text-gray-900">{c.code}</span>
                        <button type="button" onClick={() => copyCode(c.code)} className="rounded p-0.5 text-gray-400 hover:text-primary transition">
                          {copiedId === c.code ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDiscount(c)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDuration(c)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.times_redeemed}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${c.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.valid ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(c.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.valid && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(c.id, c.code)}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
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
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-gray-300 p-0.5" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="input flex-1 font-mono text-xs" />
      </div>
    </div>
  )
}

function MemberRow({ member, onRemove }: { member: Member; onRemove: () => void }) {
  const name = member.profile
    ? [member.profile.first_name, member.profile.last_name].filter(Boolean).join(' ')
    : member.email
  const username = member.profile?.username

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-900">{name}</span>
        {username && <span className="ml-2 font-mono text-xs text-gray-400">{username}@jetstreammail.com</span>}
      </div>
      {member.user_id && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Active</span>
      )}
      <button type="button" onClick={onRemove} className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function TwitterProfileSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="mb-4 h-3 w-48 rounded bg-secondary" />
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-secondary" />
          <div className="h-3 w-24 rounded bg-secondary" />
          <div className="h-3 w-full rounded bg-secondary" />
          <div className="flex gap-4">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-3 w-20 rounded bg-secondary" />
          </div>
        </div>
      </div>
    </div>
  )
}
