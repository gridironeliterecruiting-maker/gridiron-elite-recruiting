import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WelcomePage() {
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value
  if (siteSession !== 'main') {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_email, first_name')
    .eq('id', user.id)
    .single()

  const workspaceEmail = profile?.workspace_email || user.email

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/locker-room-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.60)' }} aria-hidden />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="relative h-[120px] w-[120px]">
            <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #1a3a6e 0%, #0d2040 100%)' }}
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#0047AB] mb-1">
            You&apos;re in.
          </h1>
          <p className="text-gray-500 mb-6">Welcome to Runway Recruit{profile?.first_name ? `, ${profile.first_name}` : ''}.</p>

          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Your Recruiting Email
            </p>
            <p className="text-sm font-mono font-semibold text-[#0047AB] break-all">
              {workspaceEmail}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Coaches will receive emails from this address.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="block w-full py-4 rounded-xl font-display font-bold uppercase tracking-wider text-white text-center transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
              boxShadow: '0 4px 20px rgba(200,32,47,0.35)',
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
