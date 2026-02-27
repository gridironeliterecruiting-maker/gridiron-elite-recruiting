"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Mail,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useActivePlayer } from "@/components/ActivePlayerContext"

const athleteRoutes = [
  { label: "Hub", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Programs", icon: Users, path: "/coaches" },
  { label: "Pipeline", icon: GitBranch, path: "/pipeline" },
  { label: "Outreach", icon: Mail, path: "/outreach" },
  { label: "Profile", icon: User, path: "/profile" },
]

const coachRoutes = [
  { label: "Hub", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Programs", icon: Users, path: "/coaches" },
  { label: "Outreach", icon: Mail, path: "/outreach" },
  { label: "Profile", icon: User, path: "/profile" },
]

interface Profile {
  first_name: string
  last_name: string
  position: string | null
  grad_year: number | null
  role?: string
}

interface CoachBranding {
  program_name: string
  title: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
}

export default function NavBar({
  profile,
  coachBranding,
  basePath = '',
}: {
  profile: Profile | null
  coachBranding?: CoachBranding | null
  basePath?: string
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { activePlayer, isCoach } = useActivePlayer()

  const routes = isCoach ? coachRoutes : athleteRoutes

  // Prefix routes with basePath (e.g., /cityhigh-ia/dashboard)
  const navItems = routes.map(r => ({
    ...r,
    href: `${basePath}${r.path}`,
  }))

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear program_slug cookie
    document.cookie = 'program_slug=;path=/;max-age=0'
    // Send program users to their branded login, others to generic login
    if (basePath) {
      router.push(basePath)
    } else {
      router.push("/login")
    }
  }

  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`
    : "??"

  const userSubtitle = isCoach && coachBranding
    ? coachBranding.program_name
    : profile?.grad_year
      ? `Class of ${profile.grad_year}`
      : null

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* Top accent stripe */}
        <div className="h-1 bg-accent" />

        <nav className="relative bg-primary shadow-lg">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo & Brand */}
              <Link href={`${basePath}/dashboard`} className="relative flex items-center gap-3">
                <div className="relative -mb-5 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                  <Image
                    src={coachBranding?.logo_url || "/logo.png"}
                    alt={coachBranding?.program_name ? `${coachBranding.program_name} logo` : "Gridiron Elite Recruiting logo"}
                    width={200}
                    height={200}
                    className="h-[72px] w-auto lg:h-[80px]"
                    priority
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-primary-foreground">
                    {coachBranding?.program_name || "Gridiron Elite"}
                  </h1>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                    Recruiting
                  </p>
                </div>
              </Link>

              {/* Desktop Nav — centered */}
              <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary-foreground/15 text-primary-foreground shadow-inner ring-1 ring-primary-foreground/20"
                          : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>

              {/* User Area */}
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    >
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
                            <p className="text-[11px] text-primary-foreground/50">
                              {userSubtitle}
                            </p>
                          )}
                        </div>
                      )}
                      <ChevronDown className="hidden h-3.5 w-3.5 text-primary-foreground/50 lg:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile menu button */}
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

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <div className="border-t border-primary-foreground/10 md:hidden">
              <div className="flex flex-col gap-1 px-4 py-3">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
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
