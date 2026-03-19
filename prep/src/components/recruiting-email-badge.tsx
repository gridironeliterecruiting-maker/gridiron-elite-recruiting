"use client"

export function RecruitingEmailBadge({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        Recruiting Email
      </span>
      <span className="text-sm font-semibold text-foreground">{email}</span>
    </div>
  )
}
