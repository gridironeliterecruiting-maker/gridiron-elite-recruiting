"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Mail,
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

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Programs", icon: Users, href: "/coaches" },
  { label: "Pipeline", icon: GitBranch, href: "/pipeline" },
  { label: "Outreach", icon: Mail, href: "/outreach" },
]

interface NavbarProps {
  activePage?: string
}

export function Navbar({ activePage = "Dashboard" }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50">
      {/* Top accent stripe */}
      <div className="h-1 bg-accent" />

      <nav className="relative bg-primary shadow-lg">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo & Brand */}
            <Link href="/" className="relative flex items-center gap-3">
              {/* Oversized logo that extends below navbar */}
              <div className="relative -mb-8 mt-1 shrink-0">
                <div className="relative h-28 w-28 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)] lg:h-32 lg:w-32">
                  <Image
                    src="/logo.png"
                    alt="Gridiron Elite Recruiting logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-primary-foreground">
                  Gridiron Elite
                </h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                  Recruiting
                </p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive = item.label === activePage
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
                        PK
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left lg:block">
                      <p className="text-sm font-semibold leading-tight text-primary-foreground">
                        Paul Kongshaug
                      </p>
                      <p className="text-[11px] text-primary-foreground/50">
                        Class of 2026
                      </p>
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-primary-foreground/50 lg:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
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
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="border-t border-primary-foreground/10 md:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {navItems.map((item) => {
                const isActive = item.label === activePage
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
  )
}
