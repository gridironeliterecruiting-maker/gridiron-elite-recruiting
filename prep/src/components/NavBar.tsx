"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LayoutDashboard, Dumbbell, Newspaper, Inbox, User, LogOut, Menu, X, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navRoutes = [
  { label: "Hub", icon: LayoutDashboard, path: "/hub", showUnreadBadge: false },
  { label: "Camps", icon: Dumbbell, path: "/camps", showUnreadBadge: false },
  { label: "Media", icon: Newspaper, path: "/media", showUnreadBadge: false },
  { label: "Email", icon: Inbox, path: "/email", showUnreadBadge: true },
  { label: "Profile", icon: User, path: "/profile", showUnreadBadge: false },
]

interface Profile {
  first_name: string
  last_name: string
  position: string | null
  grad_year: number | null
}

export default function NavBar({ profile }: { profile: Profile | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/email/inbox')
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch { /* non-critical */ }
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    document.cookie = 'site_session=;path=/;max-age=0'
    router.push("/login")
  }

  const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}` : "??"
  const userSubtitle = profile?.grad_year ? `Class of ${profile.grad_year}` : null

  return (
    <>
      <header className="sticky top-0 z-50">
        <div className="h-1 bg-accent" />
        <nav className="relative bg-primary shadow-lg">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/hub" className="relative flex items-center gap-3">
                <div className="relative -mb-5 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                  <div className="relative h-[72px] w-[72px] lg:h-[80px] lg:w-[80px]">
                    <Image src="/logo.png" alt="Runway Prep" fill className="object-contain" priority />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-primary-foreground">
                    Runway Prep
                  </h1>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                    Football
                  </p>
                </div>
              </Link>

              <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
                {navRoutes.map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
                  const badgeCount = item.showUnreadBadge ? unreadCount : 0
                  return (
                    <Link
                      key={item.label}
                      href={item.path}
                      className={`relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary-foreground/15 text-primary-foreground shadow-inner ring-1 ring-primary-foreground/20"
                          : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                      {badgeCount > 0 && (
                        <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground">
                      <Avatar className="h-8 w-8 ring-2 ring-accent">
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {profile && (
                        <div className="hidden text-left lg:block">
                          <p className="text-sm font-semibold leading-tight text-primary-foreground">
                            {profile.first_name} {profile.last_name}
                          </p>
                          {userSubtitle && (
                            <p className="text-[11px] text-primary-foreground/50">{userSubtitle}</p>
                          )}
                        </div>
                      )}
                      <ChevronDown className="hidden h-3.5 w-3.5 text-primary-foreground/50 lg:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Profile Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  className="rounded-md p-2 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <span className="sr-only">Open menu</span>
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-primary-foreground/10 md:hidden">
              <div className="flex flex-col gap-1 px-4 py-3">
                {navRoutes.map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
                  const badgeCount = item.showUnreadBadge ? unreadCount : 0
                  return (
                    <Link
                      key={item.label}
                      href={item.path}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                      {badgeCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>
      </header>
    </>
  )
}
