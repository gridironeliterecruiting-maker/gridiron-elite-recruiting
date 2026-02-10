'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Coach Database', href: '/coaches' },
  { name: 'CRM Pipeline', href: '/pipeline' },
  { name: 'Outreach', href: '/outreach' },
]

interface Profile {
  first_name: string
  last_name: string
  position: string
  grad_year: number
}

export default function NavBar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="relative bg-gradient-to-r from-[#003080] via-[#0047AB] to-[#0055CC] shadow-lg h-[60px] z-30">
      {/* Decorative stars */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <span className="text-white/10 text-lg tracking-[0.5em] select-none">
          ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full relative">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            {/* Logo shield - raw shape, no circle mask, overlapping the stripe */}
            <div className="absolute top-[-2px] z-40" style={{ height: '150px', width: '130px' }}>
              <Image
                src="/logo.png"
                alt="Gridiron Elite Recruiting"
                width={130}
                height={150}
                className="object-contain drop-shadow-lg"
                priority
              />
            </div>
            <span className="text-white font-bold text-lg hidden sm:block drop-shadow-sm ml-[142px]">
              Gridiron Elite Recruiting
            </span>
          </div>

          <div className="flex items-center gap-1 relative z-10">
            {tabs.map(tab => (
              <Link key={tab.href} href={tab.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname === tab.href
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}>
                {tab.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 relative z-10">
            {profile && (
              <div className="text-right hidden sm:block">
                <div className="text-white text-sm font-medium">{profile.first_name} {profile.last_name}</div>
                <div className="text-blue-200 text-xs">{profile.position} &middot; Class of {profile.grad_year}</div>
              </div>
            )}
            <button onClick={handleSignOut}
              className="text-blue-200 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
