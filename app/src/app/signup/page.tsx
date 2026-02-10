'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    grad_year: '', position: '', high_school: '', city: '', state: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          grad_year: parseInt(form.grad_year),
          position: form.position,
          high_school: form.high_school,
          city: form.city,
          state: form.state,
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Insert profile
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        grad_year: parseInt(form.grad_year),
        position: form.position,
        high_school: form.high_school,
        city: form.city,
        state: form.state,
      })
    }

    router.push('/dashboard')
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-lg p-8">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Gridiron Elite Recruiting" width={220} height={220} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">Create Your Account</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Start managing your recruiting journey</p>

        <form onSubmit={handleSignup} className="space-y-3">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} required minLength={6} className={inputClass} />
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
              <input type="text" value={form.state} onChange={e => update('state', e.target.value)} placeholder="TX" required maxLength={2} className={inputClass} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#E31937] text-white font-semibold rounded-lg hover:bg-[#c91530] transition disabled:opacity-50 mt-2">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-[#0047AB] font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  )
}
