'use client'

import { useState } from 'react'
import Image from 'next/image'

interface UnauthorizedPageProps {
  logoSrc?: string
  logoAlt?: string
  programName?: string
  primaryColor?: string
  coachProfileId: string
  existingRequestStatus: string | null
}

export function UnauthorizedPage({
  logoSrc = '/logo.png',
  logoAlt = 'Gridiron Elite Recruiting',
  programName,
  primaryColor,
  coachProfileId,
  existingRequestStatus,
}: UnauthorizedPageProps) {
  const color = primaryColor || '#0047AB'
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(existingRequestStatus === 'pending')
  const [error, setError] = useState('')

  const handleRequestAccess = async () => {
    setRequesting(true)
    setError('')
    try {
      const response = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachProfileId }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send request')
      }
      setRequested(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <Image src={logoSrc} alt={logoAlt} width={220} height={220} className="object-contain" />
        </div>
        {programName && (
          <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-[30px]" style={{ color }}>
            {programName}
          </h2>
        )}

        {requested ? (
          <>
            <div className="mb-6 rounded-xl border-2 p-8 flex items-center justify-center" style={{ borderColor: color, backgroundColor: `${color}08` }}>
              <p className="text-sm leading-relaxed text-gray-700 text-center">
                We have sent a request to the program administrator and will send you an email when access has been granted.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              You can close this page. You&apos;ll receive an email when your access is approved.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2" style={{ color }}>Access Required</h1>
            <p className="text-gray-500 mb-8">
              You are not currently an authorized user for this program.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleRequestAccess}
              disabled={requesting}
              className="w-full py-4 px-6 rounded-xl font-semibold text-base transition shadow-sm hover:shadow-md disabled:opacity-50 border-2"
              style={{ borderColor: color, color: color, backgroundColor: 'transparent' }}
            >
              {requesting ? 'Sending Request...' : 'Request Access'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
