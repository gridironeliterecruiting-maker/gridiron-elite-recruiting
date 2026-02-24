"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, MessageCircle, Check } from "lucide-react"
import { GoalStep } from "./steps/goal-step"
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
  { number: 1, label: "Goal" },
  { number: 2, label: "Target" },
  { number: 3, label: "Build" },
  { number: 4, label: "Launch" },
] as const

const DM_STEPS = [
  { number: 1, label: "Goal" },
  { number: 2, label: "Target" },
  { number: 3, label: "Compose" },
  { number: 4, label: "Send" },
] as const

interface CreateCampaignOverlayProps {
  programs: Program[]
  playerPosition: string
  gmailEmail: string | null
  gmailTier: string | null
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
  initialCampaignType?: CampaignType
  onClose: () => void
  onCampaignLaunched?: (campaignData: {
    name: string
    recipientCount: number
    programCount: number
  }) => void
}

export function CreateCampaignOverlay({ programs, playerPosition, gmailEmail, gmailTier, hasGmailToken, gmailTokenExpired, quickEmailData, quickDmData, initialCampaignType = 'email', onClose, onCampaignLaunched }: CreateCampaignOverlayProps) {
  const router = useRouter()
  const campaignType = initialCampaignType
  // Quick email/DM skips goal and target, goes straight to build/compose (step 3)
  const [currentStep, setCurrentStep] = useState(quickEmailData || quickDmData ? 3 : 1)
  const [maxStepReached, setMaxStepReached] = useState(quickEmailData || quickDmData ? 3 : 1)
  const [draft, setDraft] = useState<CampaignDraft>({ goal: null, selectedCoaches: [], templates: [] })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveDraftDialog, setShowSaveDraftDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dmCampaignId, setDmCampaignId] = useState<string | null>(null)
  const [dmAllSent, setDmAllSent] = useState(false)

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
                goal: quickEmailData.goal as CampaignGoal,
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
                goal: quickDmData.goal as CampaignGoal,
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

  const handleGoalSelect = (goal: CampaignGoal) => {
    setDraft((prev) => ({ ...prev, goal }))
    setHasUnsavedChanges(true)
    goToStep(2)
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
    goToStep(4)
  }

  // Header icon and title
  const headerIcon = campaignType === 'dm' ? MessageCircle : Mail
  const headerTitle = campaignType === 'dm' ? 'New X DM Campaign' : 'New Email Campaign'
  const HeaderIcon = headerIcon

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto bg-background duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
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
          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const canNavigate = step.number <= maxStepReached
              const isCompleted = currentStep > step.number || (step.number === steps.length && dmAllSent)
              return (
                <div key={step.number} className="flex flex-1 items-center">
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => canNavigate && goToStep(step.number)}
                    className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
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
        {currentStep === 1 && (
          <GoalStep onSelect={handleGoalSelect} selected={draft.goal} channelFilter={campaignType} />
        )}

        {currentStep === 2 && (
          <TargetStep
            programs={programs}
            playerPosition={playerPosition}
            selectedCoaches={draft.selectedCoaches}
            channelFilter={campaignType}
            onCoachesChange={(coaches) => {
              setDraft((prev) => ({ ...prev, selectedCoaches: coaches }))
              setHasUnsavedChanges(true)
            }}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
            initialNavState={targetNavState}
            onNavStateChange={setTargetNavState}
          />
        )}

        {/* Email flow: Build (step 3) */}
        {currentStep === 3 && campaignType !== 'dm' && draft.goal && (
          <BuildStep
            goal={draft.goal}
            templates={draft.templates}
            onTemplatesChange={(templates: EmailTemplate[]) => {
              setDraft((prev) => ({ ...prev, templates }))
              setHasUnsavedChanges(true)
            }}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )}

        {/* Email flow: Launch (step 4) */}
        {currentStep === 4 && campaignType !== 'dm' && draft.goal && (
          <LaunchStep
            goal={draft.goal}
            selectedCoaches={draft.selectedCoaches}
            templates={draft.templates}
            gmailEmail={gmailEmail}
            gmailTier={gmailTier}
            hasGmailToken={hasGmailToken}
            gmailTokenExpired={gmailTokenExpired}
            onEditTarget={() => goToStep(2)}
            onEditBuild={() => goToStep(3)}
            onBack={() => goToStep(3)}
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

        {/* DM flow: Compose (step 3) */}
        {currentStep === 3 && campaignType === 'dm' && draft.goal && (
          <DmComposeStep
            goal={draft.goal}
            selectedCoaches={draft.selectedCoaches}
            onCreateDmCampaign={handleCreateDmCampaign}
            onBack={() => goToStep(2)}
          />
        )}

        {/* DM flow: Send (step 4) — embedded DM queue */}
        {currentStep === 4 && campaignType === 'dm' && dmCampaignId && (
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
        defaultTitle={`${draft.goal || 'New'} Campaign`}
      />
    </div>
  )
}
