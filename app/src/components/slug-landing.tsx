'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'

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
  schoolName: string
  programCity: string
  programState: string
}

export function SlugLanding({
  logoSrc,
  logoAlt,
  programName,
  primaryColor,
  accentColor,
  slug,
  backgroundImage = '/locker-room-bg.png',
  schoolName,
  programCity,
  programState,
}: SlugLandingProps) {
  const color = primaryColor || '#0047AB'
  const accent = accentColor || '#CC0000'

  type View = 'home' | 'register' | 'success'
  const [view, setView] = useState<View>('home')
  const [createdEmail, setCreatedEmail] = useState('')
  const [createdRole, setCreatedRole] = useState<'coach' | 'player' | null>(null)

  // Invite
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [validatedRole, setValidatedRole] = useState<'coach' | 'player' | null>(null)

  // Login
  const [username, setUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Shared registration fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')

  // Coach-only
  const [title, setTitle] = useState('')

  // Player-only
  const [position, setPosition] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [gpa, setGpa] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [hudlUrl, setHudlUrl] = useState('')

  // Username / email
  const [generatedUsername, setGeneratedUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const supabase = createClient()
  const router = useRouter()

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

  // ── Username availability (coaches: numeric suffix; players: jersey suffix) ──
  const checkUsername = useCallback(async (first: string, last: string, role: 'coach' | 'player', jersey: string) => {
    const base = generateBaseUsername(first, last)
    if (base.length < 2) {
      setGeneratedUsername('')
      setUsernameAvailable(null)
      return
    }

    let candidates: string[]
    if (role === 'coach') {
      // Numeric suffix: ryansmith → ryansmith1 → ryansmith2 ...
      candidates = [base, ...Array.from({ length: 9 }, (_, i) => `${base}${i + 1}`)]
    } else {
      // Jersey suffix for players
      candidates = jersey
        ? [base, `${base}${jersey}`, `${base}-${jersey}`, `${base}.${jersey}`]
        : [base]
    }

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
    if (!validatedRole) return
    const t = setTimeout(() => {
      if (firstName && lastName) {
        checkUsername(firstName, lastName, validatedRole, jerseyNumber)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [firstName, lastName, jerseyNumber, validatedRole, checkUsername])

  // ── Registration submit ─────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError('')

    if (password !== confirmPassword) { setRegisterError('Passwords do not match.'); return }
    if (password.length < 8) { setRegisterError('Password must be at least 8 characters.'); return }
    if (!generatedUsername || usernameAvailable === false) { setRegisterError('Username unavailable. Try a different name.'); return }

    setRegisterLoading(true)

    const res = await fetch('/api/auth/register-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode,
        slug,
        firstName,
        lastName,
        username: generatedUsername,
        password,
        recoveryEmail,
        // Coach fields
        title: validatedRole === 'coach' ? title || null : null,
        highSchool: schoolName,
        city: programCity,
        state: programState,
        // Player-only fields
        position: validatedRole === 'player' ? position || null : null,
        gradYear: validatedRole === 'player' ? gradYear || null : null,
        jerseyNumber: validatedRole === 'player' ? jerseyNumber || null : null,
        gpa: validatedRole === 'player' ? gpa || null : null,
        height: validatedRole === 'player' ? height || null : null,
        weight: validatedRole === 'player' ? weight || null : null,
        hudlUrl: validatedRole === 'player' ? hudlUrl || null : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setRegisterError(data.error || 'Something went wrong.')
      setRegisterLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.workspaceEmail,
      password,
    })

    if (signInError) {
      setRegisterError('Account created but sign-in failed. Try logging in with your username.')
      setRegisterLoading(false)
      return
    }

    document.cookie = `site_session=${slug};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    setCreatedEmail(data.workspaceEmail)
    setCreatedRole(validatedRole)
    setView('success')
  }

  // ── Login submit ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    const loginInput = username.trim().toLowerCase()
    const loginEmail = loginInput.includes('@') ? loginInput : `${loginInput}@${WORKSPACE_DOMAIN}`
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (signInError) {
      setLoginError('Incorrect username or password.')
      setLoginLoading(false)
      return
    }

    // Verify this user is actually a member of this program before granting access
    const memberRes = await fetch(`/api/auth/check-slug-membership?slug=${encodeURIComponent(slug)}`)
    const memberData = await memberRes.json()

    if (!memberData.member) {
      await supabase.auth.signOut()
      setLoginError('No account found for this program. Register with your invite code or contact your coach.')
      setLoginLoading(false)
      return
    }

    document.cookie = `site_session=${slug};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    router.push(`/${slug}/hub`)
  }

  // ── Shared layout ───────────────────────────────────────────────────────────
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
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.62)' }} aria-hidden />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Program Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative h-[160px] w-[160px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Image src={logoSrc} alt={logoAlt} fill className="object-contain" priority />
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-widest" style={{ color }}>
            {programName}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 mt-0.5">
            Recruiting Hub
          </p>
        </div>

        {view === 'home' && (
          <>
            {/* Invite Code */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 mb-5 border border-white">
              <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3" style={{ background: `${color}18`, color }}>
                New Member
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Join the Program</h1>
              <p className="text-sm text-gray-500 mb-5">Enter the invite code your coach shared with you.</p>

              <form onSubmit={handleValidateInvite} className="space-y-3">
                {inviteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{inviteError}</div>
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

            {/* Login */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome Back</h2>
              <p className="text-sm text-gray-500 mb-5">Sign in to your recruiting hub.</p>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{loginError}</div>
                )}
                <FocusInput label="Username" type="text" value={username} onChange={setUsername} placeholder="ryansmith" autoComplete="username" color={color} />
                <FocusInput label="Password" type="password" value={loginPassword} onChange={setLoginPassword} placeholder="Your password" autoComplete="current-password" color={color} />
                <div className="text-right -mt-2">
                  <Link href="/forgot-password" className="text-xs hover:underline" style={{ color }}>Forgot password?</Link>
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

        {view === 'register' && validatedRole === 'coach' && (
          <CoachRegisterForm
            color={color}
            accent={accent}
            slug={slug}
            inviteCode={inviteCode}
            schoolName={schoolName}
            programCity={programCity}
            programState={programState}
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName} setLastName={setLastName}
            title={title} setTitle={setTitle}
            password={password} setPassword={setPassword}
            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            recoveryEmail={recoveryEmail} setRecoveryEmail={setRecoveryEmail}
            generatedUsername={generatedUsername}
            usernameAvailable={usernameAvailable}
            checkingUsername={checkingUsername}
            registerLoading={registerLoading}
            registerError={registerError}
            onSubmit={handleRegister}
            onBack={() => { setView('home'); setInviteError('') }}
          />
        )}

        {view === 'register' && validatedRole === 'player' && (
          <PlayerRegisterForm
            color={color}
            accent={accent}
            slug={slug}
            inviteCode={inviteCode}
            schoolName={schoolName}
            programCity={programCity}
            programState={programState}
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName} setLastName={setLastName}
            position={position} setPosition={setPosition}
            gradYear={gradYear} setGradYear={setGradYear}
            jerseyNumber={jerseyNumber} setJerseyNumber={setJerseyNumber}
            gpa={gpa} setGpa={setGpa}
            height={height} setHeight={setHeight}
            weight={weight} setWeight={setWeight}
            hudlUrl={hudlUrl} setHudlUrl={setHudlUrl}
            password={password} setPassword={setPassword}
            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            recoveryEmail={recoveryEmail} setRecoveryEmail={setRecoveryEmail}
            generatedUsername={generatedUsername}
            usernameAvailable={usernameAvailable}
            checkingUsername={checkingUsername}
            registerLoading={registerLoading}
            registerError={registerError}
            onSubmit={handleRegister}
            onBack={() => { setView('home'); setInviteError('') }}
          />
        )}

        {view === 'success' && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white text-center">
            <div className="flex justify-center mb-5">
              <div className="rounded-full p-4" style={{ background: `${color}15` }}>
                <CheckCircle2 className="h-14 w-14" style={{ color }} strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re In!</h1>
            <p className="text-sm text-gray-500 mb-5">
              Your {createdRole === 'coach' ? 'coaching' : 'player'} account has been created.
            </p>
            <div className="rounded-xl p-4 mb-6" style={{ background: `${color}08`, border: `2px solid ${color}25` }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: `${color}99` }}>
                Your Recruiting Email
              </p>
              <p className="text-sm font-mono font-bold" style={{ color }}>{createdEmail}</p>
              <p className="text-xs text-gray-400 mt-1">Save this — it&apos;s how coaches will hear from you.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/${slug}/hub`)}
              className="w-full py-4 rounded-xl text-white font-bold text-sm tracking-wide transition flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}
            >
              Go to My Hub <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Coach registration form ─────────────────────────────────────────────────

function CoachRegisterForm({
  color, accent,
  schoolName, programCity, programState,
  firstName, setFirstName, lastName, setLastName,
  title, setTitle,
  password, setPassword, confirmPassword, setConfirmPassword,
  recoveryEmail, setRecoveryEmail,
  generatedUsername, usernameAvailable, checkingUsername,
  registerLoading, registerError,
  onSubmit, onBack,
}: any) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
      <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3" style={{ background: `${color}18`, color }}>
        Coach Registration
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h1>
      <p className="text-sm text-gray-500 mb-6">Set up your coaching profile.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        {registerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{registerError}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FocusInput label="First Name" type="text" value={firstName} onChange={setFirstName} required color={color} />
          <FocusInput label="Last Name" type="text" value={lastName} onChange={setLastName} required color={color} />
        </div>

        <FocusInput label="Title" type="text" value={title} onChange={setTitle} placeholder="Head Coach, OC, DC…" color={color} />

        {/* Pre-populated school info */}
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">High School</label>
            <div className="px-4 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600">{schoolName}</div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">City</label>
            <div className="px-3 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600 truncate">{programCity}</div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">State</label>
            <div className="px-3 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600">{programState}</div>
          </div>
        </div>

        {/* Email preview */}
        <EmailPreview color={color} generatedUsername={generatedUsername} checkingUsername={checkingUsername} usernameAvailable={usernameAvailable} />

        {/* Password */}
        <PasswordFields color={color} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} generatedUsername={generatedUsername} />

        {/* Recovery email — last, de-emphasized */}
        <RecoveryEmailField color={color} value={recoveryEmail} onChange={setRecoveryEmail} />

        <SubmitButton color={color} accent={accent} loading={registerLoading} disabled={!generatedUsername || usernameAvailable === false || password !== confirmPassword || password.length < 8} />

        <BackButton onBack={onBack} />
      </form>
    </div>
  )
}

// ── Player registration form ────────────────────────────────────────────────

function PlayerRegisterForm({
  color, accent,
  schoolName, programCity, programState,
  firstName, setFirstName, lastName, setLastName,
  position, setPosition, gradYear, setGradYear, jerseyNumber, setJerseyNumber,
  gpa, setGpa, height, setHeight, weight, setWeight, hudlUrl, setHudlUrl,
  password, setPassword, confirmPassword, setConfirmPassword,
  recoveryEmail, setRecoveryEmail,
  generatedUsername, usernameAvailable, checkingUsername,
  registerLoading, registerError,
  onSubmit, onBack,
}: any) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-7 border border-white">
      <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3" style={{ background: `${color}18`, color }}>
        Player Registration
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h1>
      <p className="text-sm text-gray-500 mb-6">Your recruiting email is generated from your name.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        {registerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{registerError}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FocusInput label="First Name" type="text" value={firstName} onChange={setFirstName} required color={color} />
          <FocusInput label="Last Name" type="text" value={lastName} onChange={setLastName} required color={color} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FocusInput label="Position" type="text" value={position} onChange={setPosition} placeholder="QB" color={color} />
          <FocusInput label="Grad Year" type="number" value={gradYear} onChange={setGradYear} placeholder="2026" color={color} />
          <FocusInput label="Jersey #" type="text" value={jerseyNumber} onChange={setJerseyNumber} placeholder="33" maxLength={3} color={color} />
        </div>

        {/* Pre-populated school info */}
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">High School</label>
            <div className="px-4 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600">{schoolName}</div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">City</label>
            <div className="px-3 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600 truncate">{programCity}</div>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">State</label>
            <div className="px-3 py-2.5 border-2 border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-600">{programState}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FocusInput label="GPA" type="number" step="0.01" value={gpa} onChange={setGpa} placeholder="3.5" color={color} />
          <FocusInput label="Height" type="text" value={height} onChange={setHeight} placeholder={'6\'2"'} color={color} />
          <FocusInput label="Weight" type="number" value={weight} onChange={setWeight} placeholder="185" color={color} />
        </div>

        <FocusInput label="Hudl URL" type="url" value={hudlUrl} onChange={setHudlUrl} placeholder="https://hudl.com/..." color={color} />

        {/* Email preview */}
        <EmailPreview color={color} generatedUsername={generatedUsername} checkingUsername={checkingUsername} usernameAvailable={usernameAvailable} />

        {/* Password */}
        <PasswordFields color={color} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} generatedUsername={generatedUsername} />

        {/* Recovery email — last, de-emphasized */}
        <RecoveryEmailField color={color} value={recoveryEmail} onChange={setRecoveryEmail} />

        <SubmitButton color={color} accent={accent} loading={registerLoading} disabled={!generatedUsername || usernameAvailable === false || password !== confirmPassword || password.length < 8} />

        <BackButton onBack={onBack} />
      </form>
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function EmailPreview({ color, generatedUsername, checkingUsername, usernameAvailable }: {
  color: string
  generatedUsername: string
  checkingUsername: boolean
  usernameAvailable: boolean | null
}) {
  return (
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
          {!checkingUsername && usernameAvailable === false && <span className="text-xs text-red-500 font-semibold">unavailable</span>}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">Enter your name above</p>
      )}
      <p className="text-xs text-gray-400 mt-1">Coaches will receive emails from this address.</p>
    </div>
  )
}

function PasswordFields({ color, password, setPassword, confirmPassword, setConfirmPassword, generatedUsername }: {
  color: string
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  generatedUsername: string
}) {
  return (
    <div className="space-y-3">
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          You will log in with:
        </p>
        <div className="bg-gray-50 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">Username</span>
          <span className="text-sm font-mono font-semibold text-[#0047AB]">
            {generatedUsername || <span className="text-gray-400 italic">generated from your name</span>}
          </span>
        </div>
      </div>
      <FocusInput
        label="Password (min 8 characters)"
        type="password"
        value={password}
        onChange={setPassword}
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
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          placeholder="Repeat your password"
          autoComplete="new-password"
          color={confirmPassword && password !== confirmPassword ? '#ef4444' : color}
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="text-red-500 text-xs mt-1">Passwords don&apos;t match</p>
        )}
      </div>
    </div>
  )
}

function RecoveryEmailField({ color, value, onChange }: { color: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="pt-1">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        Personal email
        <span className="ml-1 font-normal text-gray-300">(for password resets only — never shared)</span>
      </label>
      <FocusInput
        label=""
        type="email"
        value={value}
        onChange={onChange}
        placeholder="your@gmail.com"
        required
        color={color}
      />
    </div>
  )
}

function SubmitButton({ color, accent, loading, disabled }: { color: string; accent: string; loading: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-4 rounded-xl text-white font-bold text-sm tracking-wide transition disabled:opacity-50 mt-2"
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}
    >
      {loading ? 'Creating your account...' : 'CREATE ACCOUNT'}
    </button>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1">
      ← Back
    </button>
  )
}

// ── Reusable focused input ──────────────────────────────────────────────────

function FocusInput({
  label, type, value, onChange, placeholder, required,
  autoComplete, minLength, maxLength, step, color,
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
      {label && <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>}
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
