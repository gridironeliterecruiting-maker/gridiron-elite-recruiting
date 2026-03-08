'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const WORKSPACE_DOMAIN = 'flightschoolmail.com'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

function generateBaseUsername(firstName: string, lastName: string): string {
  return `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ─── New User Setup (coming from /checkout) ───────────────────────────────────

function NewUserSetup({
  subscriptionId,
  checkoutEmail,
  plan,
}: {
  subscriptionId: string
  checkoutEmail: string
  plan: string
}) {
  const router = useRouter()
  const supabase = createClient()

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
    recovery_email: checkoutEmail,
    password: '',
    confirm_password: '',
  })

  const [username, setUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // Debounced username generation from name
  const checkUsername = useCallback(async (first: string, last: string, jersey: string) => {
    const base = generateBaseUsername(first, last)
    if (base.length < 2) {
      setUsername('')
      setUsernameAvailable(null)
      return
    }

    // Full collision chain matching server-side logic:
    // base → base+jersey → base-jersey → base.jersey → base (no jersey)
    const candidates = jersey
      ? [base, `${base}${jersey}`, `${base}-${jersey}`, `${base}.${jersey}`]
      : [base]

    setCheckingUsername(true)
    try {
      for (const candidate of candidates) {
        const res = await fetch(`/api/auth/check-username?name=${encodeURIComponent(candidate)}`)
        const data = await res.json()
        if (data.available) {
          setUsername(candidate)
          setUsernameAvailable(true)
          return
        }
      }
      // All taken — show last candidate as unavailable
      setUsername(candidates[candidates.length - 1])
      setUsernameAvailable(false)
    } finally {
      setCheckingUsername(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.first_name && form.last_name) {
        checkUsername(form.first_name, form.last_name, form.jersey_number)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.first_name, form.last_name, form.jersey_number, checkUsername])

  const workspaceEmail = username ? `${username}@${WORKSPACE_DOMAIN}` : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!username) {
      setError('Username could not be generated. Please check your name fields.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        email: checkoutEmail,
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
        username,
        password: form.password,
        recoveryEmail: form.recovery_email || checkoutEmail,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Sign in with workspace credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.workspaceEmail,
      password: form.password,
    })

    if (signInError) {
      setError('Account created but sign-in failed. Please go to login and use your username + password.')
      setLoading(false)
      return
    }

    document.cookie = `site_session=main;path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`
    router.push('/welcome')
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundImage: 'url(/locker-room-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />
      <div className="relative z-10 w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Runway Recruit" width={180} height={180} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">Complete Your Profile</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Tell us about yourself so coaches know who you are</p>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-2xl shadow-xl p-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input type="text" value={form.position} onChange={e => update('position', e.target.value)} placeholder="QB, WR…" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grad Year</label>
              <input type="number" value={form.grad_year} onChange={e => update('grad_year', e.target.value)} placeholder="2026" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jersey #</label>
              <input type="text" value={form.jersey_number} onChange={e => update('jersey_number', e.target.value)} placeholder="33" maxLength={3} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">High School</label>
            <input type="text" value={form.high_school} onChange={e => update('high_school', e.target.value)} required className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={form.city} onChange={e => update('city', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={form.state} onChange={e => update('state', e.target.value)} placeholder="IA" required maxLength={2} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GPA</label>
              <input type="number" step="0.01" value={form.gpa} onChange={e => update('gpa', e.target.value)} placeholder="3.5" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
              <input type="text" value={form.height} onChange={e => update('height', e.target.value)} placeholder={'6\'2"'} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
              <input type="number" value={form.weight} onChange={e => update('weight', e.target.value)} placeholder="185" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hudl Profile URL</label>
            <input type="url" value={form.hudl_url} onChange={e => update('hudl_url', e.target.value)} placeholder="https://www.hudl.com/profile/..." className={inputClass} />
          </div>

          {/* Workspace Email Preview */}
          <div className="border-t border-gray-200 pt-4 mt-2">
            <div className="bg-blue-50 rounded-xl p-4 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Your Recruiting Email
              </p>
              {workspaceEmail ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-[#0047AB] break-all">
                    {workspaceEmail}
                  </p>
                  {checkingUsername && <span className="text-xs text-gray-400">checking...</span>}
                  {!checkingUsername && usernameAvailable === true && (
                    <span className="text-xs text-green-600 font-semibold">✓ available</span>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <span className="text-xs text-red-500 font-semibold">taken</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Enter your name to generate your email</p>
              )}
              <p className="text-xs text-gray-500 mt-1.5">Coaches will receive emails from this address.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recovery Email
                <span className="ml-1 text-xs text-gray-400 font-normal">(for password resets only — never shared)</span>
              </label>
              <input
                type="email"
                value={form.recovery_email}
                onChange={e => update('recovery_email', e.target.value)}
                placeholder="your@gmail.com"
                className={inputClass}
              />
            </div>
          </div>

          {/* Account Credentials */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              You will log in with:
            </p>

            <div className="bg-gray-50 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-3">
              <span className="text-xs text-gray-500">Username</span>
              <span className="text-sm font-mono font-semibold text-[#0047AB]">
                {username || <span className="text-gray-400 italic">generated from your name</span>}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-xs font-normal text-gray-400">(min 8 characters)</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  required
                  minLength={8}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={e => update('confirm_password', e.target.value)}
                  required
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={`${inputClass} ${form.confirm_password && form.password !== form.confirm_password ? 'border-red-300' : ''}`}
                />
                {form.confirm_password && form.password !== form.confirm_password && (
                  <p className="text-red-500 text-xs mt-1">Passwords don&apos;t match</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || usernameAvailable === false || form.password !== form.confirm_password || form.password.length < 8}
            className="w-full py-3 bg-[#E31937] text-white font-semibold rounded-lg hover:bg-[#c91530] transition disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating your account...' : 'Create Account & Start Recruiting'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Existing User Profile Update (already logged in) ─────────────────────────


function ExistingUserSetup() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', position: '', grad_year: '',
    jersey_number: '', high_school: '', city: '', state: '',
    gpa: '', hudl_url: '', height: '', weight: '', phone: '', twitter_handle: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata
        setForm(f => ({
          ...f,
          first_name: meta?.full_name?.split(' ')[0] || meta?.first_name || '',
          last_name: meta?.full_name?.split(' ').slice(1).join(' ') || meta?.last_name || '',
        }))
      }
    }
    prefill()
  }, [supabase])

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      first_name: form.first_name,
      last_name: form.last_name,
      email: user.email,
      grad_year: parseInt(form.grad_year),
      position: form.position,
      jersey_number: form.jersey_number || null,
      high_school: form.high_school,
      city: form.city,
      state: form.state,
      gpa: form.gpa ? parseFloat(form.gpa) : null,
      hudl_url: form.hudl_url || null,
      height: form.height || null,
      weight: form.weight ? parseInt(form.weight) : null,
      phone: form.phone || null,
      twitter_handle: form.twitter_handle || null,
    })

    if (profileError) { setError(profileError.message); setLoading(false); return }

    const siteSession = getCookie('site_session')
    if (siteSession && siteSession !== 'main') {
      router.push(`/${siteSession}/dashboard`)
    } else {
      router.push('/dashboard')
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundImage: 'url(/locker-room-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />
      <div className="relative z-10 w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Runway Recruit" width={180} height={180} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">Complete Your Profile</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Tell us about yourself so coaches know who you are</p>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-2xl shadow-xl p-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input type="text" value={form.position} onChange={e => update('position', e.target.value)} placeholder="QB, WR…" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grad Year</label>
              <input type="number" value={form.grad_year} onChange={e => update('grad_year', e.target.value)} placeholder="2026" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jersey #</label>
              <input type="text" value={form.jersey_number} onChange={e => update('jersey_number', e.target.value)} placeholder="33" maxLength={3} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">High School</label>
            <input type="text" value={form.high_school} onChange={e => update('high_school', e.target.value)} required className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={form.city} onChange={e => update('city', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={form.state} onChange={e => update('state', e.target.value)} placeholder="IA" required maxLength={2} className={inputClass} />
            </div>
          </div>

          <div className="border-t border-gray-200 my-4" />
          <p className="text-xs text-gray-500 -mt-1">These help personalize your emails to coaches</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GPA</label>
              <input type="number" step="0.01" value={form.gpa} onChange={e => update('gpa', e.target.value)} placeholder="3.5" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
              <input type="text" value={form.height} onChange={e => update('height', e.target.value)} placeholder={'6\'2"'} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
              <input type="number" value={form.weight} onChange={e => update('weight', e.target.value)} placeholder="185" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hudl Profile URL</label>
            <input type="url" value={form.hudl_url} onChange={e => update('hudl_url', e.target.value)} placeholder="https://www.hudl.com/profile/..." className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(555) 123-4567" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">X Handle</label>
              <input type="text" value={form.twitter_handle} onChange={e => update('twitter_handle', e.target.value)} placeholder="@handle" className={inputClass} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#E31937] text-white font-semibold rounded-lg hover:bg-[#c91530] transition disabled:opacity-50 mt-2">
            {loading ? 'Saving...' : 'Complete Setup & Start Recruiting'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Router: decide which setup flow to show ──────────────────────────────────

function ProfileSetupInner() {
  const searchParams = useSearchParams()
  const subId = searchParams.get('sub_id')
  const email = searchParams.get('email') || ''
  const plan = searchParams.get('plan') || 'monthly'

  if (subId) {
    return <NewUserSetup subscriptionId={subId} checkoutEmail={decodeURIComponent(email)} plan={plan} />
  }

  return <ExistingUserSetup />
}

export default function ProfileSetupPage() {
  return (
    <Suspense>
      <ProfileSetupInner />
    </Suspense>
  )
}
