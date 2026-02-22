"use client"

import { useState, useRef } from "react"
import { Loader2, MessageCircle, Eye, EyeOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { CampaignGoal, SelectedCoach } from "../types"
import { resolveMergeTags } from "@/lib/merge-tags"

const DM_MERGE_TAGS = [
  { key: "Coach Name", label: "Coach Name" },
  { key: "School", label: "School" },
  { key: "First Name", label: "First Name" },
  { key: "Position", label: "Position" },
  { key: "Film Link", label: "Film Link" },
]

const GOAL_DM_TEMPLATES: Record<CampaignGoal, string> = {
  get_response:
    "Coach ((Coach Name)), my name is ((First Name)) and I'm a ((Position)) very interested in ((School)). I'd love to connect about your program. Here's my film: ((Film Link))",
  evaluate_film:
    "Coach ((Coach Name)), I wanted to share my latest film with you. I believe I can contribute at ((School)). ((Film Link)) — ((First Name)), ((Position))",
  build_interest:
    "Coach ((Coach Name)), I've been following ((School)) closely and I'm very interested in your program. I'd love to tell you more about myself. ((First Name)), ((Position))",
  secure_visit:
    "Coach ((Coach Name)), I'd love to set up a campus visit to ((School)). Is there a good time to connect? ((First Name)), ((Position))",
  other:
    "Coach ((Coach Name)),\n\n\n\n((First Name))",
}

interface DmComposeStepProps {
  goal: CampaignGoal
  selectedCoaches: SelectedCoach[]
  onCreateDmCampaign: (name: string, messageBody: string) => Promise<void>
  onBack: () => void
}

export function DmComposeStep({
  goal,
  selectedCoaches,
  onCreateDmCampaign,
  onBack,
}: DmComposeStepProps) {
  const [campaignName, setCampaignName] = useState(
    `DM — ${goal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
  )
  const [messageBody, setMessageBody] = useState(GOAL_DM_TEMPLATES[goal])
  const [showPreview, setShowPreview] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = messageBody.length
  const isLong = charCount > 280

  // Sample coach for live preview
  const sampleCoach = selectedCoaches[0] || {
    coachName: "John Smith",
    programName: "Sample University",
  }

  const previewText = resolveMergeTags(messageBody, {
    coachName: sampleCoach.coachName,
    schoolName: sampleCoach.programName,
    playerFirstName: "Your Name",
    position: "QB",
    filmLink: "hudl.com/your-film",
  })

  const insertMergeTag = (tag: string) => {
    if (!textareaRef.current) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const newBody =
      messageBody.slice(0, start) + `((${tag}))` + messageBody.slice(end)
    setMessageBody(newBody)
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = start + tag.length + 4
        textareaRef.current.selectionStart = pos
        textareaRef.current.selectionEnd = pos
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleCreate = async () => {
    if (!campaignName.trim() || !messageBody.trim()) return
    setIsCreating(true)
    try {
      await onCreateDmCampaign(campaignName, messageBody)
    } finally {
      setIsCreating(false)
    }
  }

  const canCreate =
    campaignName.trim().length > 0 &&
    messageBody.trim().length > 0 &&
    selectedCoaches.length > 0

  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
        Compose Your DM
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Write a single message template. Merge tags will be personalized for each coach.
      </p>

      {/* Campaign Name */}
      <div className="mb-6">
        <label
          htmlFor="dm-campaign-name"
          className="mb-2 block text-xs font-medium text-foreground"
        >
          Campaign Name
        </label>
        <input
          id="dm-campaign-name"
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="e.g., DM — Film Drop"
        />
      </div>

      {/* Merge Tag Buttons */}
      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium text-foreground">
          Insert Merge Tag
        </label>
        <div className="flex flex-wrap gap-1">
          {DM_MERGE_TAGS.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() => insertMergeTag(tag.key)}
              className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message Textarea */}
      <div className="mb-2">
        <textarea
          ref={textareaRef}
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          rows={6}
          maxLength={10000}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Type your DM message here..."
        />
      </div>

      {/* Character Counter */}
      <div className="mb-6 flex items-center justify-between text-[11px]">
        <span className={isLong ? "text-amber-500" : "text-muted-foreground"}>
          {charCount} characters
          {isLong && " — DMs work best when short and direct"}
        </span>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1 text-primary hover:underline"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3 w-3" /> Hide Preview
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Preview
            </>
          )}
        </button>
      </div>

      {/* Live Preview */}
      {showPreview && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.02] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <MessageCircle className="h-3.5 w-3.5" />
            Preview for {sampleCoach.coachName}
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {previewText}
          </p>
        </Card>
      )}

      {/* Summary */}
      <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recipients
            </p>
            <p className="mt-1 font-bold text-foreground">
              {selectedCoaches.length} coaches
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Programs
            </p>
            <p className="mt-1 font-bold text-foreground">
              {new Set(selectedCoaches.map((c) => c.programId)).size} schools
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate || isCreating}
          className="flex items-center gap-2 rounded-md bg-accent px-6 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <MessageCircle className="h-3.5 w-3.5" />
              Create DM Queue
            </>
          )}
        </button>
      </div>
    </div>
  )
}
