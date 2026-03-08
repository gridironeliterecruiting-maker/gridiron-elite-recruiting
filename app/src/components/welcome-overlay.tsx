'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export function WelcomeOverlay() {
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('runway_welcome')
    if (raw) {
      try {
        const data = JSON.parse(raw)
        setEmail(data.workspaceEmail || '')
      } catch {}
      localStorage.removeItem('runway_welcome')
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* White overlay — same as locker room pages */}
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.82)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0) 100%)' }} />

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-md">
        <div className="relative h-[120px] w-[120px] mb-6 drop-shadow-2xl">
          <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
        </div>

        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-[#0047AB] mb-3">
          You&apos;re In.
        </h1>
        <p className="text-xl font-semibold text-gray-700 mb-6">
          Welcome to Runway Recruit.
        </p>

        {email && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-4 mb-6 w-full">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Your Recruiting Email
            </p>
            <p className="font-mono font-bold text-[#0047AB] text-sm break-all">{email}</p>
            <p className="text-xs text-gray-500 mt-1">Coaches will receive emails from this address.</p>
          </div>
        )}

        <button
          onClick={() => setShow(false)}
          className="w-full py-4 rounded-xl font-display font-black uppercase tracking-widest text-white text-lg transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
            boxShadow: '0 4px 24px rgba(200,32,47,0.45)',
          }}
        >
          LET&apos;S GO
        </button>
      </div>
    </div>
  )
}
