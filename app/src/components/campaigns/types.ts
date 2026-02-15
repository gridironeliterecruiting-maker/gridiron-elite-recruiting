export type CampaignGoal = "get_response" | "evaluate_film" | "build_interest" | "secure_visit"

export interface EmailTemplate {
  name: string
  subject: string
  body: string
  delayDays: number | null // null = first email (no delay)
}
