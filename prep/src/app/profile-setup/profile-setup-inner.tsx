'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const PRIMARY_COLOR = '#cc2222'

function ProfileSetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subId = searchParams.get('sub_id')
  const plan = searchParams.get('plan')
  const supabase = createClient()

  const [form, setForm] = useState({
    first_name: '', last_name: '', position: '', grad_year: '',
    jersey_number: '', high_school: '', city: '', state: '',
    gpa: '', height: '', weight: '',
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
    if (!user) { setError('Not authenticated. Please go back and log in.'); setLoading(false); return }

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subId || null,
        plan: plan || 'monthly',
        firstName: form.first_name, lastName: form.last_name,
        position: form.position, gradYear: form.grad_year,
        jerseyNumber: form.jersey_number || null,
        highSchool: form.high_school, city: form.city, state: form.state,
        gpa: form.gpa || null, height: form.height || null,
        weight: form.weight || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }

    router.push('/hub')
  }

  const inputClass = 'w-full px-4 py-2.5 border-2 rounded-xl bg-white focus:outline-none text-sm transition-colors'
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = PRIMARY_COLOR }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#e5e7eb' }

  return (
    <div
      className="relative min-h-screen flex items-start justify-center px-4 py-12"
      style={{ backgroundImage: 'url(/locker-room-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="relative h-[100px] w-[100px]">
            <Image src="/logo.png" alt="Runway Prep" fill className="object-contain" priority />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white">
          <h1 className="text-2xl font-display font-bold text-center mb-1 uppercase" style={{ color: '#111' }}>
            Complete Your Profile
          </h1>
          <p className="text-center text-gray-500 mb-6 text-sm">
            Tell us about the athlete so we can build their brand.
          </p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">First Name</label>
              <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Position</label>
              <input type="text" value={form.position} onChange={e => update('position', e.target.value)} placeholder="QB, WR…" required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Grad Year</label>
              <input type="number" value={form.grad_year} onChange={e => update('grad_year', e.target.value)} placeholder="2030" required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Jersey #</label>
              <input type="text" value={form.jersey_number} onChange={e => update('jersey_number', e.target.value)} placeholder="33" maxLength={3} className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">School / Middle School</label>
            <input type="text" value={form.high_school} onChange={e => update('high_school', e.target.value)} required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">City</label>
              <input type="text" value={form.city} onChange={e => update('city', e.target.value)} required className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">State</label>
              <input type="text" value={form.state} onChange={e => update('state', e.target.value)} placeholder="IA" required maxLength={2} className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs text-gray-400 mb-3">Physical stats help with camp tracking</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">GPA</label>
                <input type="number" step="0.01" value={form.gpa} onChange={e => update('gpa', e.target.value)} placeholder="3.5" className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Height</label>
                <input type="text" value={form.height} onChange={e => update('height', e.target.value)} placeholder={'5\'10"'} className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Weight</label>
                <input type="number" value={form.weight} onChange={e => update('weight', e.target.value)} placeholder="140" className={inputClass} style={{ borderColor: '#e5e7eb' }} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-display font-bold uppercase tracking-wider transition disabled:opacity-50 mt-2"
            style={{ background: PRIMARY_COLOR }}>
            {loading ? 'Saving...' : 'START MY PREP JOURNEY'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function ProfileSetupInner() {
  return <Suspense><ProfileSetupForm /></Suspense>
}
