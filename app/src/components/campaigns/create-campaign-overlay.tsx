"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Mail, Check } from "lucide-react"
import { GoalStep } from "./steps/goal-step"
import { TargetStep } from "./steps/target-step"
import { BuildStep } from "./steps/build-step"
import { LaunchStep } from "./steps/launch-step"
import { SaveDraftDialog } from "./save-draft-dialog"
import type { CampaignGoal, EmailTemplate } from "./types"

interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
}

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

const STEPS = [
  { number: 1, label: "Goal" },
  { number: 2, label: "Target" },
  { number: 3, label: "Build" },
  { number: 4, label: "Launch" },
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
  onClose: () => void
  onCampaignLaunched?: (campaignData: {
    name: string
    recipientCount: number
    programCount: number
  }) => void
}

export function CreateCampaignOverlay({ programs, playerPosition, gmailEmail, gmailTier, hasGmailToken, gmailTokenExpired, quickEmailData, onClose, onCampaignLaunched }: CreateCampaignOverlayProps) {
  const [currentStep, setCurrentStep] = useState(quickEmailData ? 3 : 1)
  const [maxStepReached, setMaxStepReached] = useState(quickEmailData ? 3 : 1)
  const [draft, setDraft] = useState<CampaignDraft>({ goal: null, selectedCoaches: [], templates: [] })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveDraftDialog, setShowSaveDraftDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Target step navigation state persistence
  const [targetNavState, setTargetNavState] = useState<{
    activeDivision: string | null
    expandedConference: string | null
  }>({ activeDivision: null, expandedConference: null })

  // Initialize from quick email data if provided
  useEffect(() => {
    if (quickEmailData && quickEmailData.goal && quickEmailData.coachId) {
      // Fetch coach details to populate the draft
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
                  email: coach.email
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

  const handleClose = () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges && (draft.goal || draft.selectedCoaches.length > 0 || draft.templates.length > 0)) {
      setShowSaveDraftDialog(true)
    } else {
      window.scrollTo(0, 0)
      onClose()
    }
  }

  const handleSaveDraft = async (title: string) => {
    setIsSaving(true)
    try {
      // Prepare the campaign data
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
        // Successfully saved as draft
        window.scrollTo(0, 0)
        onClose()
      } else {
        console.error('Failed to save draft')
        // You might want to show an error message to the user
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
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
              New Email Campaign
            </h1>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mx-auto max-w-7xl px-4 pb-4 lg:px-8">
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const canNavigate = step.number <= maxStepReached
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
                        currentStep > step.number
                          ? "bg-primary text-primary-foreground"
                          : currentStep === step.number
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.number ? <Check className="h-3.5 w-3.5" /> : step.number}
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
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
          <GoalStep onSelect={handleGoalSelect} selected={draft.goal} />
        )}

        {currentStep === 2 && (
          <TargetStep
            programs={programs}
            playerPosition={playerPosition}
            selectedCoaches={draft.selectedCoaches}
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

        {currentStep === 3 && draft.goal && (
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

        {currentStep === 4 && draft.goal && (
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
              // Mark as saved since campaign is launched
              setHasUnsavedChanges(false)
              
              // Close the overlay
              window.scrollTo(0, 0)
              onClose()
              
              // Show the success overlay if callback provided
              if (onCampaignLaunched) {
                onCampaignLaunched(campaignData)
              }
            }}
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
