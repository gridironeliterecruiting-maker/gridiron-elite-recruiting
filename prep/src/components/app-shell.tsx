'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Dumbbell,
  BookOpen,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Hub', icon: LayoutDashboard },
  { href: '/exposure', label: 'Exposure', icon: Target, badge: 'Primary' },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/academics', label: 'Academics', icon: BookOpen },
  { href: '/profile', label: 'Athlete Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface Profile {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Athlete {
  id: string
  first_name: string
  last_name: string
  sport: string
  grad_year: number
}

interface AppShellProps {
  profile: Profile
  athletes: Athlete[]
  children: React.ReactNode
}

export function AppShell({ profile, athletes, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const primaryAthlete = athletes[0]

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-6 py-4 border-b border-sidebar-border flex justify-center">
        <div className="relative h-[80px] w-[80px]">
          <Image src="/logo.png" alt="Runway Elite Prep" fill className="object-contain" priority />
        </div>
      </div>

      {/* Athlete selector */}
      {primaryAthlete && (
        <div className="px-4 py-3 mx-3 mt-4 rounded-lg bg-sidebar-accent">
          <p className="text-xs text-white/60 uppercase tracking-wide font-medium mb-1">Athlete</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{primaryAthlete.first_name} {primaryAthlete.last_name}</p>
              <p className="text-xs text-white/70 capitalize">{primaryAthlete.sport} · Class of {primaryAthlete.grad_year}</p>
            </div>
            {athletes.length > 1 && <ChevronDown className="w-4 h-4 text-white/60" />}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-white/60 capitalize">{profile.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="p-1.5 rounded hover:bg-white/10 transition text-white/60 hover:text-white"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 z-50">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded hover:bg-gray-100 transition">
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative h-8 w-8">
            <Image src="/logo.png" alt="Runway Elite Prep" fill className="object-contain" />
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="ml-auto p-1.5 rounded hover:bg-gray-100 transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
