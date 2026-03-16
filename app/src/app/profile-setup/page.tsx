'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

// ─── You're In Overlay ────────────────────────────────────────────────────────

function YoureInOverlay({
  loginEmail,
  provider,
  onClose,
}: {
  loginEmail: string
  provider: string
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState(loginEmail)
  const [displayEmail, setDisplayEmail] = useState(loginEmail)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const supabase = createClient()
  const isGoogle = provider === 'google'

  const handleSaveEmail = async () => {
    if (!newEmail.trim() || newEmail === displayEmail) {
      setEditing(false)
      return
    }
    setEditLoading(true)
    setEditError('')
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) {
      setEditError(error.message)
      setEditLoading(false)
      return
    }
    setDisplayEmail(newEmail.trim())
    setEditing(false)
    setEditLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Checkmark */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h2 className="font-display text-3xl font-bold uppercase tracking-wider text-gray-900 mb-2">
          You&apos;re in.
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Welcome to Runway Recruit. Your recruiting journey starts now.
        </p>

        {/* Login email card */}
        <div className="bg-secondary rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            You will log in with:
          </p>
          {editing ? (
            <div className="space-y-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                autoFocus
              />
              {editError && <p className="text-red-500 text-xs">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEmail}
                  disabled={editLoading}
                  className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setNewEmail(displayEmail); setEditError('') }}
                  className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-mono font-semibold text-gray-800 break-all">{displayEmail}</p>
              {!isGoogle && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-primary font-semibold hover:underline shrink-0"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-xl bg-accent text-accent-foreground font-display font-bold uppercase tracking-widest text-lg transition hover:opacity-90"
        >
          LET&apos;S GO
        </button>
      </div>
    </div>
  )
}

// ─── Profile Setup Form ───────────────────────────────────────────────────────

function ProfileSetupInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const subId = searchParams.get('sub_id')
  const plan = searchParams.get('plan') || 'monthly'

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    position: '',
    grad_year: '',
    jersey_number: '',
    high_school: '',
    city: '',
    state: '',
    gpa: '',
    height: '',
    weight: '',
    hudl_url: '',
    twitter_handle: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [provider, setProvider] = useState('email')

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // Prefill from Google metadata if available
  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata
        setForm(f => ({
          ...f,
          first_name: meta?.first_name || meta?.full_name?.split(' ')[0] || '',
          last_name: meta?.last_name || meta?.full_name?.split(' ').slice(1).join(' ') || '',
        }))
        setLoginEmail(user.email || '')
        // Detect provider
        const identities = user.identities ?? []
        const isGoogle = identities.some((id: { provider: string }) => id.provider === 'google')
        setProvider(isGoogle ? 'google' : 'email')
      }
    }
    prefill()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated. Please go back and log in.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subId || null,
        plan,
        firstName: form.first_name,
        lastName: form.last_name,
        position: form.position,
        gradYear: form.grad_year,
        jerseyNumber: form.jersey_number || null,
        highSchool: form.high_school,
        city: form.city,
        state: form.state,
        gpa: form.gpa || null,
        height: form.height || null,
        weight: form.weight || null,
        hudlUrl: form.hudl_url || null,
        twitterHandle: form.twitter_handle || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setShowOverlay(true)
    setLoading(false)
  }

  const inputClass =
    'w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors'

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'hsl(var(--primary))'
  }
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#e5e7eb'
  }

  return (
    <>
      {showOverlay && (
        <YoureInOverlay
          loginEmail={loginEmail}
          provider={provider}
          onClose={() => router.push('/hub')}
        />
      )}

      <div
        className="relative min-h-screen flex items-start justify-center px-4 py-12"
        style={{
          backgroundImage: 'url(/locker-room-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

        <div className="relative z-10 w-full max-w-lg">
          <div className="flex justify-center mb-6">
            <div className="relative h-[100px] w-[100px]">
              <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white">
            <h1 className="text-2xl font-display font-bold text-center text-primary mb-1 uppercase">
              Complete Your Profile
            </h1>
            <p className="text-center text-gray-500 mb-6 text-sm">
              Tell us about yourself so coaches know who you are.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={e => update('first_name', e.target.value)}
                  required
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => update('last_name', e.target.value)}
                  required
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Position</label>
                <input
                  type="text"
                  value={form.position}
                  onChange={e => update('position', e.target.value)}
                  placeholder="QB, WR…"
                  required
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Grad Year</label>
                <input
                  type="number"
                  value={form.grad_year}
                  onChange={e => update('grad_year', e.target.value)}
                  placeholder="2026"
                  required
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Jersey #</label>
                <input
                  type="text"
                  value={form.jersey_number}
                  onChange={e => update('jersey_number', e.target.value)}
                  placeholder="33"
                  maxLength={3}
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">High School</label>
              <input
                type="text"
                value={form.high_school}
                onChange={e => update('high_school', e.target.value)}
                required
                className={inputClass}
                style={{ borderColor: '#e5e7eb' }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => update('city', e.target.value)}
                  required
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => update('state', e.target.value)}
                  placeholder="IA"
                  required
                  maxLength={2}
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs text-gray-400 mb-3">These help personalize your emails to coaches</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">GPA</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.gpa}
                    onChange={e => update('gpa', e.target.value)}
                    placeholder="3.5"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Height</label>
                  <input
                    type="text"
                    value={form.height}
                    onChange={e => update('height', e.target.value)}
                    placeholder={'6\'2"'}
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Weight</label>
                  <input
                    type="number"
                    value={form.weight}
                    onChange={e => update('weight', e.target.value)}
                    placeholder="185"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Hudl Profile URL</label>
              <input
                type="url"
                value={form.hudl_url}
                onChange={e => update('hudl_url', e.target.value)}
                placeholder="https://www.hudl.com/profile/..."
                className={inputClass}
                style={{ borderColor: '#e5e7eb' }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Twitter / X Handle</label>
              <input
                type="text"
                value={form.twitter_handle}
                onChange={e => update('twitter_handle', e.target.value)}
                placeholder="@yourhandle"
                className={inputClass}
                style={{ borderColor: '#e5e7eb' }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-display font-bold uppercase tracking-wider transition hover:bg-primary/90 disabled:opacity-50 mt-2"
            >
              {loading ? 'Saving...' : 'LAUNCH MY RECRUITING'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default function ProfileSetupPage() {
  return (
    <Suspense>
      <ProfileSetupInner />
    </Suspense>
  )
}
