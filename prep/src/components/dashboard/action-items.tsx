import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, CheckCircle2, Clock, ArrowRight } from "lucide-react"

const sampleActions = [
  {
    id: 1,
    title: "Follow up with Coach Davis",
    program: "Ohio State",
    dueDate: "Tomorrow",
    priority: "high" as const,
    type: "follow-up",
  },
  {
    id: 2,
    title: "Send highlight reel",
    program: "Michigan",
    dueDate: "This week",
    priority: "medium" as const,
    type: "outreach",
  },
  {
    id: 3,
    title: "Complete athletic profile",
    program: "General",
    dueDate: "This week",
    priority: "low" as const,
    type: "task",
  },
]

const emptyState = true // Set to false to show sample actions

export function ActionItems() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base font-bold">Action Items</CardTitle>
        </div>
        <Badge variant="secondary" className="text-xs font-medium">
          {emptyState ? "0" : sampleActions.length} pending
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {emptyState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {"You're all caught up!"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Action items from your outreach and pipeline will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sampleActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="group flex items-center gap-3 rounded-lg border border-transparent bg-secondary/50 px-4 py-3 text-left transition-all hover:border-border hover:bg-secondary hover:shadow-sm"
              >
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    action.priority === "high"
                      ? "bg-accent"
                      : action.priority === "medium"
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{action.program}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {action.dueDate}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
