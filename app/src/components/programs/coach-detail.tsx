"use client"

import {
  X,
  Mail,
  Phone,
  Twitter,
  Briefcase,
  Copy,
  Check,
} from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QuickEmailModal } from "@/components/campaigns/quick-email-modal"
import type { CampaignGoal } from "@/components/campaigns/types"

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
}

interface Coach {
  id: string
  program_id: string
  first_name: string
  last_name: string
  title: string
  email: string
  phone?: string | null
  twitter_handle: string | null
  twitter_dm_open: boolean
}

interface CoachDetailProps {
  coach: Coach
  program: Program
  onClose: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function CoachDetail({ coach, program, onClose }: CoachDetailProps) {
  const router = useRouter()
  const [showQuickEmail, setShowQuickEmail] = useState(false)
  const [showQuickDm, setShowQuickDm] = useState(false)

  const handleEmailGoalSelected = (goal: CampaignGoal) => {
    // Navigate to outreach page with pre-filled values
    const params = new URLSearchParams({
      goal: goal,
      coaches: coach.id,
      program: program.id,
      quickEmail: 'true'
    })
    router.push(`/outreach?${params.toString()}`)
  }

  const handleDmGoalSelected = (goal: CampaignGoal) => {
    const params = new URLSearchParams({
      goal: goal,
      coaches: coach.id,
      program: program.id,
      quickDm: 'true'
    })
    router.push(`/outreach?${params.toString()}`)
  }

  const hasDm = coach.twitter_dm_open && coach.twitter_handle
  const hasEmail = !!coach.email

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] overflow-y-auto duration-200">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close coach detail"
      />

      {/* Slide-in panel */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-card shadow-2xl sm:rounded-l-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-primary/20">
              {coach.first_name[0]}{coach.last_name[0]}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
                {coach.first_name} {coach.last_name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{coach.title}</span>
                <span className="text-xs text-muted-foreground/40">at</span>
                <span className="text-xs font-semibold text-primary">{program.school_name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5">
            {/* Contact Info */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                Contact Information
                <div className="h-px flex-1 bg-border" />
              </h3>
              <div className="flex flex-col gap-2">
                {coach.email && (
                  <Card className="flex items-center gap-3 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                      <p className="truncate text-sm font-medium text-foreground">{coach.email}</p>
                    </div>
                    <CopyButton text={coach.email} />
                  </Card>
                )}

                {coach.phone && (
                  <Card className="flex items-center gap-3 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium text-foreground">{coach.phone}</p>
                    </div>
                    <CopyButton text={coach.phone} />
                  </Card>
                )}

                {coach.twitter_handle && (
                  <Card className="flex items-center gap-3 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Twitter className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Twitter / X</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">@{coach.twitter_handle}</p>
                        {coach.twitter_dm_open && (
                          <Badge variant="secondary" className="text-[9px]">DM Open</Badge>
                        )}
                      </div>
                    </div>
                    <CopyButton text={`@${coach.twitter_handle}`} />
                  </Card>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                Role Details
                <div className="h-px flex-1 bg-border" />
              </h3>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{coach.title || "Coach"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className="rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                        {program.division}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{program.conference}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 border-t border-border px-5 py-4">
          {hasDm && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowQuickDm(true)}
            >
              <Twitter className="mr-2 h-4 w-4" />
              Send DM
            </Button>
          )}
          {hasEmail && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowQuickEmail(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          )}
          {coach.phone && (
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => { window.location.href = `tel:${coach.phone}` }}
            >
              <Phone className="mr-2 h-4 w-4" />
              Call
            </Button>
          )}
        </div>
      </div>

      {/* Quick Email Modal */}
      {showQuickEmail && (
        <QuickEmailModal
          coach={{
            id: coach.id,
            first_name: coach.first_name,
            last_name: coach.last_name,
            title: coach.title || "Coach",
            school_name: program.school_name
          }}
          onContinue={handleEmailGoalSelected}
          onClose={() => setShowQuickEmail(false)}
        />
      )}

      {/* Quick DM Modal */}
      {showQuickDm && (
        <QuickEmailModal
          coach={{
            id: coach.id,
            first_name: coach.first_name,
            last_name: coach.last_name,
            title: coach.title || "Coach",
            school_name: program.school_name
          }}
          channel="dm"
          onContinue={handleDmGoalSelected}
          onClose={() => setShowQuickDm(false)}
        />
      )}
    </div>
  )
}
