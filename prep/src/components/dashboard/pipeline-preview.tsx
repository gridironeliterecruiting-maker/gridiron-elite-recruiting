import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart3 } from "lucide-react"

const stages = [
  { name: "Researching", count: 4, total: 10, color: "bg-primary" },
  { name: "Initial Contact", count: 3, total: 10, color: "bg-primary/70" },
  { name: "In Conversation", count: 2, total: 10, color: "bg-amber-500" },
  { name: "Official Visit", count: 1, total: 10, color: "bg-emerald-500" },
  { name: "Offer Received", count: 0, total: 10, color: "bg-accent" },
]

export function PipelinePreview() {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2.5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        <CardTitle className="text-base font-bold">Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4">
          {stages.map((stage) => (
            <div key={stage.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {stage.name}
                </span>
                <span className="font-display text-sm font-bold text-foreground">
                  {stage.count}
                </span>
              </div>
              <Progress
                value={(stage.count / stage.total) * 100}
                className="h-2 bg-secondary"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
