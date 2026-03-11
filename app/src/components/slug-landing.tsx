'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2 } from 'lucide-react'

const WORKSPACE_DOMAIN = 'jetstreammail.com'

function generateBaseUsername(firstName: string, lastName: string): string {
  return `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface SlugLandingProps {
  logoSrc: string
  logoAlt: string
  programName: string
  primaryColor: string
  accentColor: string
  slug: string
  backgroundImage?: string
}

export function SlugLanding({
  logoSrc,
  logoAlt,
  programName,
  primaryColor,
  accentColor,
  slug,
  backgroundImage = '/locker-room-bg.png',
}: SlugLandingProps) {
  const color = primaryColor || '#0047AB'
  const accent = accentColor || '#CC0000'

  // ── State machine ──────────────────────────────────────────────────────────
  // 'home'      → invite code box + login section
  // 'register'  → full registration form (invite already validated)
  type View = 'home' | 'register'
  const [view, setView] = useState<View>('home')

  // Invite code entry
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [validatedRole, setValidatedRole] = useState<'coach' | 'player' | null>(null)

  // Login
  const [username, setUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Registration form
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
    recovery_email: '',
    password: '',
    confirm_password: '',
  })
  const [generatedUsername, setGeneratedUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [lookingUpProfile, setLookingUpProfile] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // ── Invite code validation ──────────────────────────────────────────────────
  const handleValidateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')

    const res = await fetch(`/api/auth/validate-invite?code=${encodeURIComponent(inviteCode)}&slug=${encodeURIComponent(slug)}`)
    const data = await res.json()

    if (!data.valid) {
      setInviteError(data.error || 'Invalid invite code')
      setInviteLoading(false)
      return
    }

    setValidatedRole(data.role)
    setView('register')
    setInviteLoading(false)
  }

  // ── Username availability check ─────────────────────────────────────────────
  const checkUsername = useCallback(async (first: string, last: string, jersey: string) => {
    const base = generateBaseUsername(first, last)
    if (base.length < 2) {
      setGeneratedUsername('')
      setUsernameAvailable(null)
      return
    }
    const candidates = jersey
      ? [base, `${base}${jersey}`, `${base}-${jersey}`, `${base}.${jersey}`]
      : [base]

    setCheckingUsername(true)
    try {
      for (const candidate of candidates) {
        const res = await fetch(`/api/auth/check-username?name=${encodeURIComponent(candidate)}`)
        const data = await res.json()
        if (data.available) {
          setGeneratedUsername(candidate)
          setUsernameAvailable(true)
          return
        }
      }
      setGeneratedUsername(candidates[candidates.length - 1])
      setUsernameAvailable(false)
    } finally {
      setCheckingUsername(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.first_name && form.last_name) {
        checkUsername(form.first_name, form.last_name, form.jersey_number)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form.first_name, form.last_name, form.jersey_number, checkUsername])

  // ── Profile lookup for pre-population ──────────────────────────────────────
  const handleRecoveryEmailBlur = async () => {
    const email = form.recovery_email.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    setLookingUpProfile(true)
    try {
      const res = await fetch(`/api/auth/lookup-profile?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (data.found && data.profile) {
        const p = data.profile
        setForm(f => ({
          ...f,
          first_name: p.first_name || f.first_name,
          last_name: p.last_name || f.last_name,
          position: p.position || f.position,
          grad_year: p.grad_year ? String(p.grad_year) : f.grad_year,
          jersey_number: p.jersey_number || f.jersey_number,
          high_school: p.high_school || f.high_school,
          city: p.city || f.city,
          state: p.state || f.state,
          gpa: p.gpa ? String(p.gpa) : f.gpa,
          height: p.height || f.height,
          weight: p.weight ? String(p.weight) : f.weight,
          hudl_url: p.hudl_url || f.hudl_url,
        }))
      }
    } catch {
      // Silently ignore — pre-fill is a convenience, not critical
    } finally {
      setLookingUpProfile(false)
    }
  }

  // ── Registration submit ─────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError('')

    if (form.password !== form.confirm_password) {
      setRegisterError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setRegisterError('Password must be at least 8 characters.')
      return
    }
    if (!generatedUsername || usernameAvailable === false) {
      setRegisterError('Please wait for username to be confirmed available.')
      return
    }

    setRegisterLoading(true)

    const res = await fetch('/api/auth/register-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode,
        slug,
        firstName: form.first_name,
        lastName: form.last_name,
        username: generatedUsername,
        password: form.password,
        recoveryEmail: form.recovery_email,
        position: form.position || null,
        gradYear: form.grad_year || null,
        jerseyNumber: form.jersey_number || null,
        highSchool: form.high_school || null,
        city: form.city || null,
        state: form.state || null,
        gpa: form.gpa || null,
        height: form.height || null,
        weight: form.weight || null,
        hudlUrl: form.hudl_url || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setRegisterError(data.error || 'Something went wrong.')
      setRegisterLoading(false)
      return
    }

    // Sign in with new workspace credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.workspaceEmail,
      password: form.password,
    })

    if (signInError) {
      setRegisterError('Account created but sign-in failed. Try logging in with your username.')
      setRegisterLoading(false)
      return
    }

    document.cookie = `site_session=${slug};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`
    router.push(`/${slug}/hub`)
  }

  // ── Login submit ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    const workspaceEmail = `${username.trim().toLowerCase()}@${WORKSPACE_DOMAIN}`

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: workspaceEmail,
      password: loginPassword,
    })

    if (signInError) {
      setLoginError('Incorrect username or password.')
      setLoginLoading(false)
      return
    }

    document.cookie = `site_session=${slug};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`
    router.push(`/${slug}/hub`)
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const inputClass = `w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors`

  const getInputStyle = (focused: boolean) => ({
    borderColor: focused ? color : '#e5e7eb',
  })

  // ── Layout wrapper (shared background) ─────────────────────────────────────
  return (
    <div
      className="relative min-h-screen flex items-start justify-center py-12 px-4"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Overlays */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.62)' }} aria-hidden />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Program Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-[160px] w-[160px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image src={logoSrc} alt={logoAlt} fill className="object-contain" priority />
          </div>
          <h2
            className="mt-3 font-display text-2xl font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {programName}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 mt-0.5">
            Recruiting Hub
          </p>
        </div>

        {view === 'home' && (
          <>
            {/* ── Invite Code Section ─────────────────────────────────────── */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 mb-5 border border-white">
              <div
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3"
                style={{ background: `${color}18`, color }}
              >
                New Athlete
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                Join the Program
              </h1>
              <p className="text-sm text-gray-500 mb-5">
                Enter the invite code your coach shared with you.
              </p>

              <form onSubmit={handleValidateInvite} className="space-y-3">
                {inviteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {inviteError}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="INVITE CODE"
                    required
                    maxLength={12}
                    autoComplete="off"
                    className="flex-1 px-4 py-3 border-2 rounded-xl bg-white focus:outline-none text-sm font-mono font-semibold tracking-widest uppercase transition-colors"
                    style={{ borderColor: inviteCode ? color : '#e5e7eb' }}
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteCode.trim()}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-white font-semibold text-sm transition disabled:opacity-50 whitespace-nowrap"
                    style={{ background: color }}
                  >
                    {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join <ChevronRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Login Section ───────────────────────────────────────────── */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome Back</h2>
              <p className="text-sm text-gray-500 mb-5">Sign in to your recruiting hub.</p>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {loginError}
                  </div>
                )}

                <FocusInput
                  label="Username"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  placeholder="ryansmith"
                  autoComplete="username"
                  color={color}
                />
                <FocusInput
                  label="Password"
                  type="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder="Your password"
                  autoComplete="current-password"
                  color={color}
                />

                <div className="text-right -mt-2">
                  <Link href="/forgot-password" className="text-xs hover:underline" style={{ color }}>
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3.5 rounded-xl text-white font-semibold transition disabled:opacity-50"
                  style={{ background: color }}
                >
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              <a href="https://runwayrecruit.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
              {' · '}
              <a href="https://runwayrecruit.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
            </p>
          </>
        )}

        {view === 'register' && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
            {/* Header */}
            <div
              className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ background: `${color}18`, color }}
            >
              {validatedRole === 'coach' ? 'Coach' : 'Player'} Registration
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h1>
            <p className="text-sm text-gray-500 mb-6">
              Your recruiting email will be generated from your name.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              {registerError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {registerError}
                </div>
              )}

              {/* Recovery email first — enables pre-population */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Your Personal Email
                  <span className="ml-1.5 text-[10px] font-normal text-gray-400 normal-case tracking-normal">(for password resets only)</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={form.recovery_email}
                    onChange={e => update('recovery_email', e.target.value)}
                    onBlur={handleRecoveryEmailBlur}
                    placeholder="your@gmail.com"
                    required
                    className={inputClass}
                    style={{ borderColor: form.recovery_email ? color : '#e5e7eb' }}
                  />
                  {lookingUpProfile && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Your Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <FocusInput label="First Name" type="text" value={form.first_name} onChange={v => update('first_name', v)} required color={color} />
                  <FocusInput label="Last Name" type="text" value={form.last_name} onChange={v => update('last_name', v)} required color={color} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FocusInput label="Position" type="text" value={form.position} onChange={v => update('position', v)} placeholder="QB" color={color} />
                <FocusInput label="Grad Year" type="number" value={form.grad_year} onChange={v => update('grad_year', v)} placeholder="2026" color={color} />
                <FocusInput label="Jersey #" type="text" value={form.jersey_number} onChange={v => update('jersey_number', v)} placeholder="33" maxLength={3} color={color} />
              </div>

              <FocusInput label="High School" type="text" value={form.high_school} onChange={v => update('high_school', v)} color={color} />

              <div className="grid grid-cols-2 gap-3">
                <FocusInput label="City" type="text" value={form.city} onChange={v => update('city', v)} color={color} />
                <FocusInput label="State" type="text" value={form.state} onChange={v => update('state', v)} placeholder="IA" maxLength={2} color={color} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FocusInput label="GPA" type="number" step="0.01" value={form.gpa} onChange={v => update('gpa', v)} placeholder="3.5" color={color} />
                <FocusInput label="Height" type="text" value={form.height} onChange={v => update('height', v)} placeholder={'6\'2"'} color={color} />
                <FocusInput label="Weight" type="number" value={form.weight} onChange={v => update('weight', v)} placeholder="185" color={color} />
              </div>

              <FocusInput label="Hudl URL" type="url" value={form.hudl_url} onChange={v => update('hudl_url', v)} placeholder="https://hudl.com/..." color={color} />

              {/* Workspace email preview */}
              <div className="rounded-xl p-4 border-2" style={{ borderColor: `${color}30`, background: `${color}08` }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: `${color}99` }}>
                  Your Recruiting Email
                </p>
                {generatedUsername ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-semibold" style={{ color }}>
                      {generatedUsername}@{WORKSPACE_DOMAIN}
                    </span>
                    {checkingUsername && <span className="text-xs text-gray-400">checking...</span>}
                    {!checkingUsername && usernameAvailable === true && <span className="text-xs text-green-600 font-semibold">✓ available</span>}
                    {!checkingUsername && usernameAvailable === false && <span className="text-xs text-red-500 font-semibold">taken — try a different name</span>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Enter your name above to generate your email</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Coaches will receive emails from this address.</p>
              </div>

              {/* Password */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Set Your Password</p>
                <div className="space-y-3">
                  <FocusInput
                    label="Password (min 8 characters)"
                    type="password"
                    value={form.password}
                    onChange={v => update('password', v)}
                    required
                    minLength={8}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    color={color}
                  />
                  <div>
                    <FocusInput
                      label="Confirm Password"
                      type="password"
                      value={form.confirm_password}
                      onChange={v => update('confirm_password', v)}
                      required
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      color={form.confirm_password && form.password !== form.confirm_password ? '#ef4444' : color}
                    />
                    {form.confirm_password && form.password !== form.confirm_password && (
                      <p className="text-red-500 text-xs mt-1">Passwords don&apos;t match</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  registerLoading ||
                  !generatedUsername ||
                  usernameAvailable === false ||
                  form.password !== form.confirm_password ||
                  form.password.length < 8
                }
                className="w-full py-4 rounded-xl text-white font-bold text-sm tracking-wide transition disabled:opacity-50 mt-2"
                style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}
              >
                {registerLoading ? 'Creating your account...' : 'CREATE ACCOUNT'}
              </button>

              <button
                type="button"
                onClick={() => { setView('home'); setInviteError('') }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1"
              >
                ← Back
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reusable focused input ──────────────────────────────────────────────────

function FocusInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
  maxLength,
  step,
  color,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  minLength?: number
  maxLength?: number
  step?: string
  color: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        step={step}
        className="w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors"
        style={{ borderColor: focused ? color : '#e5e7eb' }}
      />
    </div>
  )
}
