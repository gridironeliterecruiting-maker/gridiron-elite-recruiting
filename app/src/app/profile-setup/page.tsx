'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

export default function ProfileSetupPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', position: '', grad_year: '',
    high_school: '', city: '', state: '', gpa: '', hudl_url: '',
    height: '', weight: '', phone: '', twitter_handle: ''
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
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      first_name: form.first_name,
      last_name: form.last_name,
      email: user.email,
      grad_year: parseInt(form.grad_year),
      position: form.position,
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

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // Send program users back to their branded page (triggers auth check → dashboard)
    const programSlug = getCookie('program_slug')
    router.push(programSlug ? `/${programSlug}` : '/dashboard')
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-lg p-8">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Gridiron Elite Recruiting" width={220} height={220} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">Complete Your Profile</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Tell us about yourself so coaches know who you are</p>

        <form onSubmit={handleSubmit} className="space-y-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input type="text" value={form.position} onChange={e => update('position', e.target.value)} placeholder="e.g. QB, WR, LB" required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year</label>
              <input type="number" value={form.grad_year} onChange={e => update('grad_year', e.target.value)} placeholder="2026" required className={inputClass} />
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

          <div className="border-t border-gray-200 my-4"></div>
          <p className="text-xs text-gray-500 -mt-1">These help personalize your emails to coaches</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GPA</label>
              <input type="number" step="0.01" value={form.gpa} onChange={e => update('gpa', e.target.value)} placeholder="3.5" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
              <input type="text" value={form.height} onChange={e => update('height', e.target.value)} placeholder="6'2&quot;" className={inputClass} />
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
