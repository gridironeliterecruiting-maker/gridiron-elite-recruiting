"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, MessageCircle, Check } from "lucide-react"
import { TargetStep } from "./steps/target-step"
import { BuildStep } from "./steps/build-step"
import { LaunchStep } from "./steps/launch-step"
import { DmComposeStep } from "./steps/dm-compose-step"
import { SaveDraftDialog } from "./save-draft-dialog"
import { DmCampaignOverlay } from "./dm-campaign-overlay"
import type { CampaignGoal, CampaignType, EmailTemplate, SelectedCoach } from "./types"

export interface CampaignDraft {
  goal: CampaignGoal | null
  selectedCoaches: SelectedCoach[]
  templates: EmailTemplate[]
}

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  logo_url: string | null
}

const EMAIL_STEPS = [
  { number: 1, label: "Target" },
  { number: 2, label: "Template" },
  { number: 3, label: "Launch" },
] as const

const DM_STEPS = [
  { number: 1, label: "Target" },
  { number: 2, label: "Compose" },
  { number: 3, label: "Send" },
] as const

interface CreateCampaignOverlayProps {
  programs: Program[]
  playerPosition: string
  gmailEmail: string | null
  hasGmailToken: boolean
  gmailTokenExpired: boolean
  quickEmailData?: {
    goal: string | null
    coachId: string | null
    programId: string | null
  } | null
  quickDmData?: {
    goal: string | null
    coachId: string | null
    programId: string | null
  } | null
  followupData?: {
    goal: CampaignGoal
    selectedCoaches: SelectedCoach[]
  } | null
  initialCampaignType?: CampaignType
  activePlayerId?: string | null
  recruitingEmail?: string | null
  onClose: () => void
  onCampaignLaunched?: (campaignData: {
    name: string
    recipientCount: number
    programCount: number
  }) => void
}

export function CreateCampaignOverlay({ programs, playerPosition, gmailEmail, hasGmailToken, gmailTokenExpired, quickEmailData, quickDmData, followupData, initialCampaignType = 'email', activePlayerId, recruitingEmail, onClose, onCampaignLaunched }: CreateCampaignOverlayProps) {
  const router = useRouter()
  const campaignType = initialCampaignType
  // Campaign goal is always "get_response" — no goal selection step
  const campaignGoal: CampaignGoal = 'get_response'
  // Quick email/DM skips target, goes straight to template/compose (step 2)
  const [currentStep, setCurrentStep] = useState(quickEmailData || quickDmData || followupData ? 2 : 1)
  const [maxStepReached, setMaxStepReached] = useState(quickEmailData || quickDmData || followupData ? 2 : 1)
  const [draft, setDraft] = useState<CampaignDraft>({ goal: campaignGoal, selectedCoaches: followupData?.selectedCoaches || [], templates: [] })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveDraftDialog, setShowSaveDraftDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dmCampaignId, setDmCampaignId] = useState<string | null>(null)
  const [dmAllSent, setDmAllSent] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
  }, [])

  // Lock scroll while overlay is open — must target both html and body for Next.js App Router
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  // Target step navigation state persistence
  const [targetNavState, setTargetNavState] = useState<{
    activeDivision: string | null
    expandedConference: string | null
  }>({ activeDivision: null, expandedConference: null })

  // Dynamic steps based on campaign type
  const steps = campaignType === 'dm' ? DM_STEPS : EMAIL_STEPS

  // Initialize from quick email data if provided
  useEffect(() => {
    if (quickEmailData && quickEmailData.goal && quickEmailData.coachId) {
      const fetchCoachDetails = async () => {
        try {
          const res = await fetch(`/api/programs/${quickEmailData.programId}/coaches`)
          if (res.ok) {
            const coaches = await res.json()
            const coach = coaches.find((c: any) => c.id === quickEmailData.coachId)
            if (coach) {
              setDraft({
                goal: campaignGoal,
                selectedCoaches: [{
                  coachId: coach.id,
                  programId: quickEmailData.programId!,
                  programName: programs.find(p => p.id === quickEmailData.programId)?.school_name || '',
                  coachName: `${coach.first_name} ${coach.last_name}`,
                  title: coach.title || 'Coach',
                  email: coach.email,
                  twitterHandle: coach.twitter_handle || null,
                  twitterDmOpen: coach.twitter_dm_open || false,
                }],
                templates: []
              })
            }
          }
        } catch (error) {
          console.error('Failed to fetch coach details:', error)
        }
      }
      fetchCoachDetails()
    }
  }, [quickEmailData, programs])

  // Initialize from quick DM data if provided
  useEffect(() => {
    if (quickDmData && quickDmData.goal && quickDmData.coachId) {
      const fetchCoachDetails = async () => {
        try {
          const res = await fetch(`/api/programs/${quickDmData.programId}/coaches`)
          if (res.ok) {
            const coaches = await res.json()
            const coach = coaches.find((c: any) => c.id === quickDmData.coachId)
            if (coach) {
              setDraft({
                goal: campaignGoal,
                selectedCoaches: [{
                  coachId: coach.id,
                  programId: quickDmData.programId!,
                  programName: programs.find(p => p.id === quickDmData.programId)?.school_name || '',
                  coachName: `${coach.first_name} ${coach.last_name}`,
                  title: coach.title || 'Coach',
                  email: coach.email || null,
                  twitterHandle: coach.twitter_handle || null,
                  twitterDmOpen: coach.twitter_dm_open || false,
                }],
                templates: []
              })
            }
          }
        } catch (error) {
          console.error('Failed to fetch coach details:', error)
        }
      }
      fetchCoachDetails()
    }
  }, [quickDmData, programs])

  const handleClose = () => {
    if (hasUnsavedChanges && (draft.goal || draft.selectedCoaches.length > 0 || draft.templates.length > 0)) {
      setShowSaveDraftDialog(true)
    } else {
      window.scrollTo(0, 0)
      if (dmCampaignId) {
        // DM campaign was created — reload to show it in the campaign list
        window.location.reload()
        return
      }
      onClose()
    }
  }

  const handleSaveDraft = async (title: string) => {
    setIsSaving(true)
    try {
      const campaignData = {
        name: title,
        goal: draft.goal,
        status: 'draft',
        templates: draft.templates.map((template, index) => ({
          subject: template.subject,
          body: template.body,
          delayDays: template.delayDays || 0,
          name: template.name || `Email ${index + 1}`
        })),
        recipients: draft.selectedCoaches.map(coach => ({
          coachId: coach.coachId,
          coachName: coach.coachName,
          email: coach.email,
          programName: coach.programName
        }))
      }

      const response = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      })

      if (response.ok) {
        window.scrollTo(0, 0)
        onClose()
      } else {
        console.error('Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
      setShowSaveDraftDialog(false)
    }
  }

  const handleDeleteDraft = () => {
    setShowSaveDraftDialog(false)
    window.scrollTo(0, 0)
    onClose()
  }

  const handleCancelDialog = () => {
    setShowSaveDraftDialog(false)
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
    setMaxStepReached((prev) => Math.max(prev, step))
  }

  const handleCreateDmCampaign = async (name: string, messageBody: string) => {
    const response = await fetch('/api/campaigns/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        goal: draft.goal,
        type: 'dm',
        dmMessageBody: messageBody,
        playerId: activePlayerId || undefined,
        recipients: draft.selectedCoaches.map(coach => ({
          coachId: coach.coachId,
          coachName: coach.coachName,
          email: coach.email,
          programName: coach.programName,
          twitterHandle: coach.twitterHandle,
        })),
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('DM campaign API error:', response.status, errorData)
      const detail = errorData.details ? ` — ${errorData.details}` : ''
      throw new Error((errorData.error || `Failed to create DM campaign (${response.status})`) + detail)
    }

    const { campaignId } = await response.json()
    setHasUnsavedChanges(false)
    setDmCampaignId(campaignId)
    goToStep(3)
  }

  // Header icon and title
  const headerIcon = campaignType === 'dm' ? MessageCircle : Mail
  const headerTitle = campaignType === 'dm' ? 'New X DM Campaign' : 'New Email Campaign'
  const HeaderIcon = headerIcon

  return (
    <div ref={scrollContainerRef} className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto bg-background duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-border hover:text-foreground"
            aria-label="Close"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <HeaderIcon className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
              {headerTitle}
            </h1>
          </div>

        </div>

        {/* Progress Tracker */}
        <div className="mx-auto max-w-7xl px-4 pb-4 lg:px-8">
          <div className="flex w-full items-center">
            {steps.map((step, i) => {
              const canNavigate = step.number <= maxStepReached
              const isCompleted = currentStep > step.number || (step.number === steps.length && dmAllSent)
              return (
                <div key={step.number} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => canNavigate && goToStep(step.number)}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                      canNavigate ? "cursor-pointer hover:bg-secondary/80" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : currentStep === step.number
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.number}
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                  {i < steps.length - 1 && (
                    <div
                      className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${
                        currentStep > step.number ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        {/* Step 1: Target (both email and DM) */}
        {currentStep === 1 && (
          <TargetStep
            programs={programs}
            playerPosition={playerPosition}
            selectedCoaches={draft.selectedCoaches}
            channelFilter={campaignType}
            recruitingEmail={recruitingEmail}
            onCoachesChange={(coaches) => {
              setDraft((prev) => ({ ...prev, selectedCoaches: coaches }))
              setHasUnsavedChanges(true)
            }}
            onNext={() => goToStep(2)}
            onBack={handleClose}
            initialNavState={targetNavState}
            onNavStateChange={setTargetNavState}
          />
        )}

        {/* Email flow: Template (step 2) */}
        {currentStep === 2 && campaignType !== 'dm' && (
          <BuildStep
            goal={campaignGoal}
            templates={draft.templates}
            recruitingEmail={recruitingEmail}
            selectedCoaches={draft.selectedCoaches}
            onTemplatesChange={(templates: EmailTemplate[]) => {
              setDraft((prev) => ({ ...prev, templates }))
              setHasUnsavedChanges(true)
            }}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}

        {/* Email flow: Launch (step 3) */}
        {currentStep === 3 && campaignType !== 'dm' && (
          <LaunchStep
            goal={campaignGoal}
            selectedCoaches={draft.selectedCoaches}
            templates={draft.templates}
            gmailEmail={gmailEmail}
            hasGmailToken={hasGmailToken}
            gmailTokenExpired={gmailTokenExpired}
            activePlayerId={activePlayerId}
            recruitingEmail={recruitingEmail}
            onEditTarget={() => goToStep(1)}
            onEditBuild={() => goToStep(2)}
            onBack={() => goToStep(2)}
            onScrollToTop={scrollToTop}
            onLaunched={(campaignData) => {
              setHasUnsavedChanges(false)
              window.scrollTo(0, 0)
              onClose()
              if (onCampaignLaunched) {
                onCampaignLaunched(campaignData)
              }
            }}
          />
        )}

        {/* DM flow: Compose (step 2) */}
        {currentStep === 2 && campaignType === 'dm' && (
          <DmComposeStep
            goal={campaignGoal}
            selectedCoaches={draft.selectedCoaches}
            onCreateDmCampaign={handleCreateDmCampaign}
            onBack={() => goToStep(1)}
            onScrollToTop={scrollToTop}
          />
        )}

        {/* DM flow: Send (step 3) — embedded DM queue */}
        {currentStep === 3 && campaignType === 'dm' && dmCampaignId && (
          <DmCampaignOverlay
            campaignId={dmCampaignId}
            onClose={onClose}
            embedded
            onAllSent={() => setDmAllSent(true)}
          />
        )}
      </div>

      {/* Save Draft Dialog */}
      <SaveDraftDialog
        isOpen={showSaveDraftDialog}
        onSave={handleSaveDraft}
        onDelete={handleDeleteDraft}
        onCancel={handleCancelDialog}
        defaultTitle=""
      />
    </div>
  )
}
