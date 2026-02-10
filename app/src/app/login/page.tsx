'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        <div className="flex justify-center mb-3">
          <Image src="/logo.png" alt="Gridiron Elite Recruiting" width={220} height={220} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[#0047AB] mb-1">Welcome Back</h1>
        <p className="text-center text-gray-500 mb-6">Sign in to your recruiting dashboard</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#0047AB] text-white font-semibold rounded-lg hover:bg-[#003a8c] transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm text-gray-500">
          Don&apos;t have an account? <Link href="/signup" className="text-[#E31937] font-medium hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  )
}
