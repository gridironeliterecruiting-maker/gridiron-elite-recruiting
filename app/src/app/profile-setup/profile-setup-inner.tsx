'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Branding {
  name: string
  logo: string
  color: string
  bg: string
}

function ProfileSetupForm({ branding }: { branding?: Branding }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const subId = searchParams.get('sub_id')
  const plan = searchParams.get('plan') || 'monthly'
  const slug = searchParams.get('slug')
  const code = searchParams.get('code')

  const logoSrc = branding?.logo || '/logo.png'
  const siteName = branding?.name || 'Runway Recruit'
  const bgImage = branding?.bg || '/locker-room-bg.png'
  const color = branding?.color || 'hsl(var(--primary))'

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

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

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
        slug: slug || null,
        code: code || null,
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

    if (slug) {
      router.push(`/${slug}/hub`)
    } else {
      router.push('/hub')
    }
    setLoading(false)
  }

  const inputClass =
    'w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors'

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = color
  }
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#e5e7eb'
  }

  return (
    <div
      className="relative min-h-screen flex items-start justify-center px-4 py-12"
      style={{
        backgroundImage: `url(${bgImage})`,
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
            <Image src={logoSrc} alt={siteName} fill className="object-contain" priority />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white">
          <h1 className="text-2xl font-display font-bold text-center mb-1 uppercase" style={{ color: branding ? '#111' : 'hsl(var(--primary))' }}>
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

          {!branding && (
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
          )}

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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-display font-bold uppercase tracking-wider transition disabled:opacity-50 mt-2"
            style={{ background: color }}
          >
            {loading ? 'Saving...' : 'LAUNCH MY RECRUITING'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function ProfileSetupInner({ branding }: { branding?: Branding }) {
  return (
    <Suspense>
      <ProfileSetupForm branding={branding} />
    </Suspense>
  )
}
