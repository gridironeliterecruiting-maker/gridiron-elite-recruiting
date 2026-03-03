'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SPORTS = [
  { value: 'football', label: 'Football' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'lacrosse', label: 'Lacrosse' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'track', label: 'Track & Field' },
  { value: 'other', label: 'Other' },
]

const GRAD_YEARS = Array.from({ length: 8 }, (_, i) => {
  const year = new Date().getFullYear() + 4 + i
  return year
})

export default function ProfileSetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'parent' | 'athlete'>('parent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [parentData, setParentData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  })

  const [athleteData, setAthleteData] = useState({
    first_name: '',
    last_name: '',
    grad_year: String(new Date().getFullYear() + 6),
    sport: 'football',
    position: '',
    gpa: '',
  })

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentData.first_name || !parentData.last_name) {
      setError('First and last name are required.')
      return
    }
    setError('')
    setStep('athlete')
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!athleteData.first_name || !athleteData.last_name) {
      setError('Athlete first and last name are required.')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Upsert parent profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      first_name: parentData.first_name,
      last_name: parentData.last_name,
      phone: parentData.phone || null,
      role: 'parent',
    })

    if (profileErr) {
      setError(profileErr.message)
      setLoading(false)
      return
    }

    // Create athlete
    const { error: athleteErr } = await supabase.from('athletes').insert({
      parent_id: user.id,
      first_name: athleteData.first_name,
      last_name: athleteData.last_name,
      grad_year: parseInt(athleteData.grad_year),
      sport: athleteData.sport,
      position: athleteData.position || null,
      gpa: athleteData.gpa ? parseFloat(athleteData.gpa) : null,
    })

    if (athleteErr) {
      setError(athleteErr.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex-1 h-2 rounded-full ${step === 'parent' ? 'bg-blue-900' : 'bg-blue-900'}`} />
          <div className={`flex-1 h-2 rounded-full ${step === 'athlete' ? 'bg-blue-900' : 'bg-gray-200'}`} />
        </div>

        {step === 'parent' && (
          <form onSubmit={handleParentSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Welcome! Let&apos;s get set up.</h1>
              <p className="text-gray-500 mt-1 text-sm">First, tell us about yourself (the parent).</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={parentData.first_name}
                  onChange={e => setParentData(p => ({ ...p, first_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={parentData.last_name}
                  onChange={e => setParentData(p => ({ ...p, last_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={parentData.phone}
                onChange={e => setParentData(p => ({ ...p, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="(555) 555-5555"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition"
            >
              Next: Add Your Athlete
            </button>
          </form>
        )}

        {step === 'athlete' && (
          <form onSubmit={handleFinalSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Add your athlete</h1>
              <p className="text-gray-500 mt-1 text-sm">Tell us about the athlete you&apos;re developing.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={athleteData.first_name}
                  onChange={e => setAthleteData(a => ({ ...a, first_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={athleteData.last_name}
                  onChange={e => setAthleteData(a => ({ ...a, last_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
                <select
                  value={athleteData.sport}
                  onChange={e => setAthleteData(a => ({ ...a, sport: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grad Year</label>
                <select
                  value={athleteData.grad_year}
                  onChange={e => setAthleteData(a => ({ ...a, grad_year: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  {GRAD_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position (optional)</label>
                <input
                  type="text"
                  value={athleteData.position}
                  onChange={e => setAthleteData(a => ({ ...a, position: e.target.value }))}
                  placeholder="e.g. QB, WR"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current GPA (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  value={athleteData.gpa}
                  onChange={e => setAthleteData(a => ({ ...a, gpa: e.target.value }))}
                  placeholder="3.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('parent')}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Go to Dashboard'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
