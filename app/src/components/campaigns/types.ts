export type CampaignGoal = "get_response" | "evaluate_film" | "build_interest" | "secure_visit" | "other"

export type CampaignType = "email" | "dm"

export interface EmailTemplate {
  id?: string // Make optional as it might not be present for new templates
  name: string
  subject: string
  category?: string // Make optional as it might not always be needed or present
  body?: string
  delayDays: number | null
}

export interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
  twitterHandle?: string | null
  twitterDmOpen?: boolean
}
